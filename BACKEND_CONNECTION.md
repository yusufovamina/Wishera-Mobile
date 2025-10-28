# Backend Connection Guide

## Backend Services Running

The following services are running and listening on their respective ports:

- **Auth Service**: `http://localhost:5219`
- **User Service**: `http://localhost:5001`
- **Wishlist Service**: `http://localhost:5003`

## Configuration

The mobile app is configured to connect to these services with proper platform detection:

- **iOS Simulator**: Uses `http://localhost`
- **Android Emulator**: Uses `http://10.0.2.2`
- **Physical Devices**: Need to use your actual machine IP address (e.g., `http://192.168.1.x`)

## Current Status

✅ Services are running
✅ API clients configured
✅ Authentication token system working
⚠️ App will show mock data if not authenticated or if API calls fail

## To Connect Physical Device

1. Find your computer's IP address:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

2. Update the `getBaseUrl()` function in `src/api/client.ts` to use your IP:
   ```typescript
   return 'http://YOUR_IP_ADDRESS';
   ```

3. Restart the Expo app

## API Endpoints

- **Login**: `POST /api/Auth/login`
- **Register**: `POST /api/Auth/register`
- **Profile**: `GET /api/Users/profile`
- **Feed**: `GET /api/Wishlists/feed`
- **Like**: `POST /api/Wishlists/{id}/like`

## Debugging

The app now includes comprehensive logging:
- Console logs show API URLs being called
- Error responses are logged
- Request/response data is logged for debugging

Check the Metro bundler console for detailed API logs.

