import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: "autoUpdate",
			injectRegister: false,

			pwaAssets: {
				disabled: false,
				config: true,
			},

			manifest: {
				name: "gym.patrickdwyer.com",
				short_name: "gym.patrickdwyer.com",
				description: "gym.patrickdwyer.com is a platform for tracking my gym progress",
				theme_color: "#D3D3FF",
			},

			workbox: {
				globPatterns: ["**/*.{js,css,html,svg,png,ico,webp,pdf,woff2}"],
				cleanupOutdatedCaches: true,
				clientsClaim: true,
				skipWaiting: true,
			},

			// uncomment if you want to test pwa in dev env
			// devOptions: {
			// 	enabled: true,
			// 	suppressWarnings: false,
			// 	type: "module",
			// },
		}),
	],

	// Add CORS configuration for the dev server
	server: {
		cors: {
			origin: "*", // Allow requests from any origin
			methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		},
		proxy: {
			'/api': {
				target: 'http://localhost:3001',
				changeOrigin: true,
				secure: false,
			}
		}
	},

	// Ensure WASM support for SQL.js
	optimizeDeps: {
		exclude: ['sql.js']
	},

	build: {
		rollupOptions: {
			output: {
				// Ensure SQL.js WASM file is copied
				assetFileNames: (assetInfo) => {
					if (assetInfo.name === 'sql-wasm.wasm') {
						return 'sql-wasm.wasm';
					}
					return 'assets/[name]-[hash][extname]';
				}
			}
		}
	}
});
