# Environment Variables Setup

## Location
Create a `.env` file in the root directory of the `Wishera-Mobile` project (same level as `package.json`).

## Required Variables

### API Configuration
```env
API_BASE_URL=http://localhost:5219
```

### GIPHY API Key (for GIF search)
```env
EXPO_PUBLIC_GIPHY_API_KEY=your_giphy_api_key_here
```

## How to Get a GIPHY API Key

1. Go to [GIPHY Developers](https://developers.giphy.com/)
2. Sign up for a free account
3. Create a new app
4. Copy your API key
5. Paste it in the `.env` file as shown above

## Example .env File

Create a file named `.env` in the root directory with this content:

```env
# API Configuration
API_BASE_URL=http://localhost:5219

# GIPHY API Key for GIF search functionality
# Get your free API key from: https://developers.giphy.com/
EXPO_PUBLIC_GIPHY_API_KEY=your_giphy_api_key_here
```

## Notes

- Variables prefixed with `EXPO_PUBLIC_` are exposed to client-side code
- The `.env` file is loaded automatically by `app.config.ts` using `dotenv`
- After creating/modifying the `.env` file, restart your Expo development server
- Do NOT commit your `.env` file to git (it may contain sensitive keys)

