# Web CORS Setup Guide

## Problem
When running the app on web, you may see CORS errors like:
```
XMLHttpRequest cannot load http://localhost:5219/api/auth/login due to access control checks.
```

## Solution
Your backend services need to allow CORS requests from the web app origin.

### For .NET Backend Services

Add CORS configuration to each service's `Program.cs` or `Startup.cs`:

```csharp
// Allow CORS for local development
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowLocalhost",
        policy =>
        {
            policy.WithOrigins(
                "http://localhost:19006",  // Expo web default port
                "http://localhost:8081",   // Alternative Expo port
                "http://localhost:3000"    // Common web dev port
            )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
        });
});

// Use CORS
app.UseCors("AllowLocalhost");
```

### For Each Service

Apply this to:
- **Auth Service** (port 5219)
- **User Service** (port 5001)
- **Wishlist Service** (port 5003)
- **Chat Service** (port 5002)

### Quick Test

1. Make sure all backend services are running
2. Check if services respond: `curl http://localhost:5219/api/auth/login`
3. Restart backend services after adding CORS
4. Reload the web app

### Alternative: Use Mobile/Simulator

If CORS setup is complex, you can:
- Use iOS Simulator (no CORS issues)
- Use Android Emulator (no CORS issues)
- Use a physical device on the same network

These platforms don't have CORS restrictions.


