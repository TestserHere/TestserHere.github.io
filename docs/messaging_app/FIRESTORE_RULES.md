# Firestore Security Rules for Admin Panel

The admin panel uses collection group queries which require specific Firestore security rules.

## Update Your Firestore Rules

Go to Firebase Console → Firestore Database → Rules and add these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Allow collection group queries for messages (required for admin panel)
    match /{path=**}/messages/{messageId} {
      allow read: if true; // Allow reading messages from any room
    }
    
    // Allow collection group queries for users (required for admin panel)
    match /{path=**}/users/{userId} {
      allow read: if true; // Allow reading users from any room
    }
    
    // Your existing rules for chatRooms
    match /chatRooms/{roomId} {
      allow read, write: if true; // Adjust based on your needs
      
      match /messages/{messageId} {
        allow read, write: if true; // Adjust based on your needs
      }
      
      match /users/{userId} {
        allow read, write: if true; // Adjust based on your needs
      }
    }
    
    // Your existing rules for users collection
    match /users/{userId} {
      allow read, write: if true; // Adjust based on your needs
    }
  }
}
```

## Quick Setup (Temporary - for testing only)

If you want to allow all reads temporarily for testing:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if true; // Only for testing - restrict in production!
    }
  }
}
```

⚠️ **Warning**: The second rule set allows anyone to read/write everything. Only use for testing!

## After Updating Rules

1. Click "Publish" in Firebase Console
2. Wait a few seconds for rules to propagate
3. Refresh the admin panel
4. Click "Refresh All Data"

The collection group queries should now work!

