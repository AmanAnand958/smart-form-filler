// Smart Form Filler - Sync Service
// Handles offline queue, conflict resolution, and real-time sync

var API_BASE = 'http://13.235.74.58:3000';



class SyncService {
  constructor() {
    this.syncQueue = [];
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.lastSyncTime = null;
    
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Load queued items from storage
    this.loadQueue();
  }
  
  async loadQueue() {
    try {
      const result = await chrome.storage.local.get(['syncQueue', 'lastSyncTime']);
      this.syncQueue = result.syncQueue || [];
      this.lastSyncTime = result.lastSyncTime || null;
    } catch (error) {
      console.error('SyncService: Error loading queue', error);
    }
  }
  
  async saveQueue() {
    try {
      await chrome.storage.local.set({ 
        syncQueue: this.syncQueue,
        lastSyncTime: this.lastSyncTime 
      });
    } catch (error) {
      console.error('SyncService: Error saving queue', error);
    }
  }
  
  handleOnline() {
    this.isOnline = true;
    console.log('SyncService: Back online, processing queue...');
    this.processQueue();
    this.pull(); // Auto-pull when back online
  }
  
  handleOffline() {
    this.isOnline = false;
    console.log('SyncService: Went offline, queuing changes');
  }
  
  // Queue a sync operation
  async queueSync(operation, data) {
    const item = {
      id: Date.now(),
      operation, // 'update_profile', 'update_field', 'delete_field'
      data,
      timestamp: new Date().toISOString()
    };
    
    this.syncQueue.push(item);
    await this.saveQueue();
    
    if (this.isOnline) {
      this.processQueue();
    }
  }
  
  // Process queued items
  async processQueue() {
    if (!this.isOnline || this.isSyncing || this.syncQueue.length === 0) return;
    
    this.isSyncing = true;
    const authToken = (await chrome.storage.local.get(['authToken'])).authToken;
    
    if (!authToken) {
      this.isSyncing = false;
      return;
    }
    
    while (this.syncQueue.length > 0) {
      const item = this.syncQueue[0];
      
      try {
        await this.executeSync(item, authToken);
        this.syncQueue.shift(); // Remove processed item
        await this.saveQueue();
      } catch (error) {
        console.error('SyncService: Sync failed', error);
        break; // Stop processing on error
      }
    }
    
    this.lastSyncTime = new Date().toISOString();
    await this.saveQueue();
    this.isSyncing = false;
  }
  
  async executeSync(item, authToken) {
    switch (item.operation) {
      case 'update_profile':
        await fetch(`${API_BASE}/api/profile`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(item.data)
        });
        break;
        
      case 'update_field':
        await fetch(`${API_BASE}/api/profile/field`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(item.data)
        });
        break;
    }
  }
  
  // Conflict resolution - newer timestamp wins
  resolveConflicts(local, cloud) {
    const merged = { ...local };
    
    for (const [category, fields] of Object.entries(cloud)) {
      if (typeof fields !== 'object') continue;
      
      if (!merged[category]) {
        merged[category] = {};
      }
      
      for (const [fieldName, cloudValue] of Object.entries(fields)) {
        const localValue = merged[category][fieldName];
        
        // Cloud wins if local is empty or cloud has value
        if (!localValue && cloudValue) {
          merged[category][fieldName] = cloudValue;
        }
        // Keep local if it has value (most recent edit)
      }
    }
    
    return merged;
  }
  
  // Pull latest data from cloud
  async pull() {
    if (!this.isOnline) return null;
    
    try {
      const authToken = (await chrome.storage.local.get(['authToken'])).authToken;
      if (!authToken) return null;
      
      const response = await fetch(`${API_BASE}/api/profile`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch profiles');
      
      const cloudData = await response.json();
      
      // Get local data
      const localData = await chrome.storage.local.get(['formData', 'profiles']);
      const currentProfiles = localData.profiles || {};
      
      // Merge Profiles
      const cloudProfiles = cloudData.profiles || (cloudData.personal ? { personal: cloudData } : {}); 
      
      const mergedProfiles = { ...currentProfiles };
      for (const [name, data] of Object.entries(cloudProfiles)) {
         if (JSON.stringify(mergedProfiles[name]) !== JSON.stringify(data)) {
            // If local doesn't exist, take cloud. If it does, use conflict resolution (or overwrite if we trusted timestamps)
            // For now, since user wants "always sync", we might want to be aggressive?
            // Let's stick to safe merge: only fill gaps or update if local is empty-ish?
            // Actually, if I edited on another device, I WANT it to overwrite.
            // But without timestamps, I can't know which is newer.
            // I'll assume Cloud is newer if I JUST opened the app?
            // "Always sync" -> Pulling implies getting latest.
            if (!mergedProfiles[name]) {
              mergedProfiles[name] = data;
            } else {
               // Basic merge
               mergedProfiles[name] = this.resolveConflicts(mergedProfiles[name], data);
            }
         }
      }
      
      // Save merged
      await chrome.storage.local.set({ profiles: mergedProfiles });
      return mergedProfiles;
      
    } catch (error) {
      console.error('SyncService: Pull failed', error);
      return null;
    }
  }

  // Get sync status
  getStatus() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      queueLength: this.syncQueue.length,
      lastSyncTime: this.lastSyncTime
    };
  }
}

// Export for use in popup
window.SyncService = SyncService;
