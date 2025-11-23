# 📱 Physical Device Setup Guide

## Problem
When using Expo Go on a physical device, you may see "Network Error" when trying to log in, even though it works on web mobile.

## Root Cause
The backend services are binding to `localhost` only, which means they're only accessible from the same machine. Physical devices need to access your computer's network IP address.

## Solution

### Option 1: Use Production API (Easiest - Recommended)
1. Open `src/api/client.ts`
2. Change `USE_LOCAL_BACKEND` to `false`:
   ```typescript
   const USE_LOCAL_BACKEND = false;
   ```
3. Restart Expo: Press `r` in the Expo terminal or restart with `npx expo start`

This uses the production API at `https://wishera-app.onrender.com` which works everywhere.

### Option 2: Bind Backend to Network Interface (For Local Development)

1. **Find your computer's IP address:**
   - Windows: Run `ipconfig` in PowerShell/CMD
   - Look for "IPv4 Address" under your active WiFi/Ethernet adapter
   - Example: `192.168.0.133`

2. **Start backend services with network binding:**
   - Use the new script: `start-services-mobile.bat` in the backend folder
   - Or manually start each service with `--urls http://0.0.0.0:PORT`
   - Example: `dotnet run --urls http://0.0.0.0:5219`

3. **Ensure same WiFi network:**
   - Your computer and phone must be on the same WiFi network
   - Check firewall settings - Windows Firewall may block incoming connections

4. **Verify connection:**
   - The mobile app should automatically detect your IP (check console logs)
   - You should see: `Auth Service URL: http://192.168.0.133:5219` (your IP)

### Option 3: Use Expo Tunnel (Alternative)
If you can't use the same WiFi network:
```bash
npx expo start --tunnel
```
This creates a tunnel but may be slower.

## Troubleshooting

### Still getting "Network Error"?
1. **Check firewall:**
   - Windows: Allow ports 5219, 5001, 5003, 5002 through firewall
   - Or temporarily disable firewall for testing

2. **Verify IP address:**
   - Check console logs in Expo - should show your network IP, not localhost
   - If it shows localhost, the packager host detection failed

3. **Test connection:**
   - From your phone's browser, try: `http://YOUR_IP:5219/api/auth/login`
   - Should get a response (even if it's an error, it means connection works)

4. **Check backend is running:**
   - Verify all services are running
   - Check they're bound to `0.0.0.0` not `localhost`

## Current Status
✅ Packager host detection improved  
✅ Better error messages  
✅ Require cycle fixed  
⚠️ Backend must bind to `0.0.0.0` for physical device access

