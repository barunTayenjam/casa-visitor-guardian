import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: { '2xl': '1400px' }
		},
		extend: {
			fontFamily: {
				sans: ['"Geist"', '"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
				mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				security: {
					50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe',
					300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6',
					600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af',
					900: '#1e3a8a', 950: '#172554'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				'2xl': '1.25rem',
				'3xl': '1.75rem',
				'4xl': '2rem',
			},
			transitionTimingFunction: {
				spring: 'cubic-bezier(0.32, 0.72, 0, 1)',
				smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
				snappy: 'cubic-bezier(0.16, 1, 0.3, 1)',
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'fade-in-up': {
					'0%': { opacity: '0', transform: 'translateY(24px) blur(4px)' },
					'100%': { opacity: '1', transform: 'translateY(0) blur(0)' }
				},
				'fade-in': {
					'0%': { opacity: '0', transform: 'translateY(12px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'scale-in': {
					'0%': { opacity: '0', transform: 'scale(0.92)' },
					'100%': { opacity: '1', transform: 'scale(1)' }
				},
				'pulse-soft': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.5' }
				},
				'shimmer': {
					'0%': { backgroundPosition: '-200% 0' },
					'100%': { backgroundPosition: '200% 0' }
				},
				'float': {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-4px)' }
				},
				'slide-up-reveal': {
					'0%': { opacity: '0', transform: 'translateY(40px) scale(0.96)' },
					'100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
				},
				'badge-pop': {
					'0%': { opacity: '0', transform: 'scale(0) rotate(-8deg)' },
					'60%': { opacity: '1', transform: 'scale(1.15) rotate(2deg)' },
					'100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' }
				},
				'glow-pulse': {
					'0%, 100%': { boxShadow: '0 0 8px rgba(59,130,246,0.2), 0 0 20px rgba(59,130,246,0)' },
					'50%': { boxShadow: '0 0 12px rgba(59,130,246,0.4), 0 0 30px rgba(59,130,246,0.1)' }
				},
				'shimmer-sweep': {
					'0%': { transform: 'translateX(-100%) skewX(-15deg)' },
					'100%': { transform: 'translateX(200%) skewX(-15deg)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
				'accordion-up': 'accordion-up 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
				'fade-in-up': 'fade-in-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards',
				'fade-in': 'fade-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
				'scale-in': 'scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
				'pulse-soft': 'pulse-soft 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
				'shimmer': 'shimmer 2s linear infinite',
				'float': 'float 3s cubic-bezier(0.32, 0.72, 0, 1) infinite',
				'slide-up-reveal': 'slide-up-reveal 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards',
				'badge-pop': 'badge-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
				'glow-pulse': 'glow-pulse 2.5s ease-in-out infinite',
				'shimmer-sweep': 'shimmer-sweep 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
			},
			backdropBlur: {
				'2xl': '32px',
				'3xl': '48px',
				'4xl': '64px',
			}
		}
	},
	plugins: [tailwindAnimate],
} satisfies Config;
