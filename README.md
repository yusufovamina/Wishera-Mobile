# Wishera Mobile (Expo React Native)

## Setup

1. **Environment Variables**
   - Create a `.env` file in the root directory
   - See [ENV_SETUP.md](./ENV_SETUP.md) for detailed instructions
   - Minimum required: `API_BASE_URL` and `EXPO_PUBLIC_GIPHY_API_KEY` (for GIF search)

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run the App**
   ```bash
   npm run android  # Android
   npm run ios      # iOS
   npm run web      # Web
   ```

## Environment Variables

- `API_BASE_URL` - Backend API base URL (default: `http://localhost:5219`)
- `EXPO_PUBLIC_GIPHY_API_KEY` - GIPHY API key for GIF search functionality (get it from [developers.giphy.com](https://developers.giphy.com/))

For more details, see [ENV_SETUP.md](./ENV_SETUP.md).
