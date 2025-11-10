# 📱 Wishera Mobile API Configuration

## ✅ Current Configuration

The mobile app is now configured to use the **production API Gateway** by default:

```
https://wishera-app.onrender.com/api
```

This means:
- ✅ No need to run backend services locally
- ✅ Works on iOS Simulator, Android Emulator, and physical devices
- ✅ No CORS issues
- ✅ No port configuration needed
- ✅ Always uses the latest deployed backend

## 🔧 Configuration Options

### Option 1: Use Production API Gateway (Default - Recommended)

**Current setting in `src/api/client.ts`:**
```typescript
const USE_LOCAL_BACKEND = false;  // ✅ Uses production API
```

**This is the recommended setting** because:
- No local backend setup required
- Works everywhere (simulator, emulator, physical devices)
- No CORS configuration needed
- Always up-to-date with latest backend

### Option 2: Use Local Backend (For Backend Development Only)

If you're actively developing backend services locally, you can switch to local mode:

1. **Start all backend services locally:**
   ```bash
   cd /Users/amina/Downloads/Wishera-Back-backup
   ./start-all.sh
   ```

2. **Update `src/api/client.ts`:**
   ```typescript
   const USE_LOCAL_BACKEND = true;  // Use localhost
   ```

3. **Platform-specific URLs:**
   - **iOS Simulator**: `http://localhost:5001`, `http://localhost:5003`, etc.
   - **Android Emulator**: `http://10.0.2.2:5001`, `http://10.0.2.2:5003`, etc.
   - **Physical Device**: Use your computer's IP (e.g., `http://192.168.1.100:5001`)

## 🚀 How to Run the Mobile App

### Development Mode (Expo Go)

```bash
cd /Users/amina/Wishera-Mobile

# Install dependencies (first time only)
npm install

# Start Expo dev server
npx expo start

# Then:
# - Press 'i' for iOS Simulator
# - Press 'a' for Android Emulator
# - Scan QR code with Expo Go app for physical device
```

### Production Build (Standalone App)

```bash
# iOS
npx expo build:ios

# Android
npx expo build:android
```

## 🔍 API Endpoint Examples

All endpoints go through the API Gateway at `https://wishera-app.onrender.com/api`:

### Authentication
- **Login**: `POST /api/auth/login`
- **Register**: `POST /api/auth/register`
- **Verify Email**: `POST /api/auth/verify-email`

### User Profile
- **Get Profile**: `GET /api/users/profile`
- **Update Profile**: `PUT /api/users/profile`
- **Upload Avatar**: `POST /api/users/avatar`
- **Search Users**: `GET /api/users/search?query=john`

### Wishlists & Gifts
- **Get Feed**: `GET /api/wishlists/feed?page=1&pageSize=20`
- **Get Wishlist**: `GET /api/wishlists/{id}`
- **Like Wishlist**: `POST /api/wishlists/{id}/like`
- **Create Gift**: `POST /api/gift`
- **Reserve Gift**: `POST /api/gift/{id}/reserve`

### Notifications
- **Get Notifications**: `GET /api/notifications?page=1&pageSize=20`
- **Unread Count**: `GET /api/notifications/unread-count`
- **Birthdays**: `GET /api/notifications/birthdays?daysAhead=7`

### Events
- **My Events**: `GET /api/events/my-events?page=1&pageSize=10`
- **Create Event**: `POST /api/events`
- **Respond to Invitation**: `PUT /api/events/invitations/{id}/respond`

### Chat
- **Get Chat History**: `GET /api/chat/history/{userId}/{peerUserId}?page=1&pageSize=50`
- **Send Message**: Via SignalR Hub (`chatServiceUrl` for WebSocket connection)

## 🐛 Debugging

The app logs all API configuration on startup. Check the Metro bundler console:

```
=== Wishera Mobile API Configuration ===
Platform: ios
Environment: Development
Using API Gateway: true
Auth Service URL: https://wishera-app.onrender.com/api
User Service URL: https://wishera-app.onrender.com/api
Wishlist Service URL: https://wishera-app.onrender.com/api
Chat Service URL: https://wishera-app.onrender.com/api
=====================================
```

## 🔐 Authentication

The app stores the JWT token in `AsyncStorage` and automatically adds it to all API requests:

```typescript
Authorization: Bearer <token>
```

If you see authentication errors:
1. Try logging out and logging back in
2. Check if the token is expired
3. Clear app data: Settings → Apps → Wishera → Clear Data

## 📱 Platform-Specific Notes

### iOS
- Simulator can use both `localhost` and production API
- Physical devices require production API or computer's IP

### Android
- Emulator uses `10.0.2.2` for localhost
- Physical devices require production API or computer's IP

### Web (Expo Web)
- Works best with production API Gateway
- If using local backend, ensure CORS is properly configured

## 🎯 Recommended Setup

For most development work on the mobile app:

1. ✅ Keep `USE_LOCAL_BACKEND = false` (use production API)
2. ✅ Run `npx expo start` to start the dev server
3. ✅ Test on iOS Simulator or Android Emulator
4. ✅ Check Metro console for API logs
5. ✅ Login with your test account

This way you don't need to worry about running backend services locally!

## 🔄 Switching Between Production and Local

**To switch to production API (recommended):**
```typescript
const USE_LOCAL_BACKEND = false;
```

**To switch to local backend:**
```typescript
const USE_LOCAL_BACKEND = true;
```

Then restart the Expo dev server:
```bash
# Press 'r' in Expo terminal to reload
# Or stop (Ctrl+C) and run: npx expo start
```

## ✅ Current Status

- ✅ Mobile app configured to use production API Gateway
- ✅ All endpoints properly mapped
- ✅ Authentication flow working
- ✅ No CORS issues
- ✅ Works on all platforms (iOS, Android, Web)
- ✅ Ready for testing and development

