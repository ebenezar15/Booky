// Ready-made cover designs. Each `apply` restyles a book's cover object in place.
import { defaultCover } from './cover-defaults.js';

export const coverText = (id, text, o) => ({ id, kind: 'text', text, font: 'Lora', size: 4, weight: 400, italic: false, color: '#ffffff', align: 'center', x: 50, y: 50, width: 84, upper: false, spacing: 0, shadow: false, lineHeight: 1.15, visible: true, ...o });

const T = coverText;

export const COVER_TEMPLATES = {
  classic: { label: 'Classic', apply: (c) => Object.assign(c, defaultCover(), { template: 'classic' }) },
  minimal: { label: 'Minimal', apply: (c) => Object.assign(c, {
    background: { ...c.background, type: 'solid', color: '#f5f1ea', overlay: 0 },
    layers: [T('title', '{{title}}', { font: 'Cormorant Garamond', size: 10, color: '#1d1b22', y: 40, lineHeight: 1.05 }), T('subtitle', '{{subtitle}}', { font: 'Cormorant Garamond', italic: true, size: 3.6, color: '#555', y: 55 }), T('author', '{{author}}', { font: 'Cormorant Garamond', size: 3.8, color: '#1d1b22', y: 88, upper: true, spacing: 0.3 }), T('tagline', '', { y: 10, color: '#777', size: 2.4, italic: true })],
    ornament: { show: true, style: 'line', color: '#1d1b22', y: 48 }, back: { ...c.back, textColor: '#1d1b22', color: '' }, spine: { ...c.spine, color: '#1d1b22' },
  }) },
  thriller: { label: 'Thriller', apply: (c) => Object.assign(c, {
    background: { ...c.background, type: 'gradient', color: '#0b0b0f', color2: '#2a0d0d', angle: 180, overlay: 0.15 },
    layers: [T('title', '{{title}}', { font: 'Oswald', size: 15, weight: 700, upper: true, y: 62, lineHeight: 0.95, shadow: true }), T('subtitle', '{{subtitle}}', { font: 'Montserrat', size: 2.8, y: 79, upper: true, spacing: 0.2, color: '#e5e5e5' }), T('author', '{{author}}', { font: 'Oswald', size: 6, weight: 700, y: 12, upper: true, spacing: 0.15 }), T('tagline', 'THE TRUTH WILL COST EVERYTHING', { font: 'Montserrat', size: 2.2, y: 92, color: '#ff4d4d', spacing: 0.2 })],
    ornament: { show: true, style: 'line', color: '#ff4d4d', y: 74 }, spine: { ...c.spine, font: 'Oswald', color: '#ffffff' },
  }) },
  romance: { label: 'Romance', apply: (c) => Object.assign(c, {
    background: { ...c.background, type: 'gradient', color: '#f6c1cc', color2: '#b14a6d', angle: 200, overlay: 0 },
    layers: [T('title', '{{title}}', { font: 'Great Vibes', size: 15, y: 36, shadow: true, lineHeight: 1 }), T('subtitle', '{{subtitle}}', { font: 'Lora', italic: true, size: 3.4, y: 52 }), T('author', '{{author}}', { font: 'Playfair Display', size: 4.2, y: 89, upper: true, spacing: 0.2 }), T('tagline', '', { y: 10, size: 2.4, italic: true })],
    ornament: { show: true, style: 'dots', color: '#ffffff', y: 59 }, spine: { ...c.spine, font: 'Playfair Display' },
  }) },
  fantasy: { label: 'Fantasy', apply: (c) => Object.assign(c, {
    background: { ...c.background, type: 'gradient', color: '#0f2a2e', color2: '#081316', angle: 170, overlay: 0.1 },
    layers: [T('title', '{{title}}', { font: 'Cinzel', size: 9.5, weight: 700, color: '#e8c87a', y: 26, shadow: true, spacing: 0.06, lineHeight: 1.1 }), T('subtitle', '{{subtitle}}', { font: 'Cinzel', size: 2.8, color: '#d9c9a3', y: 40, spacing: 0.15 }), T('author', '{{author}}', { font: 'Cinzel', size: 4, color: '#e8c87a', y: 88, spacing: 0.2 }), T('tagline', '', { y: 94, size: 2.2, color: '#d9c9a3' })],
    ornament: { show: true, style: 'frame', color: '#c9a65a', y: 50 }, spine: { ...c.spine, font: 'Cinzel', color: '#e8c87a' },
  }) },
  literary: { label: 'Literary', apply: (c) => Object.assign(c, {
    background: { ...c.background, type: 'solid', color: '#2f3e46', overlay: 0 },
    layers: [T('title', '{{title}}', { font: 'Playfair Display', italic: true, size: 9, y: 70, align: 'left', x: 52, width: 80, color: '#f2e9e4' }), T('subtitle', '{{subtitle}}', { font: 'Lora', size: 3, y: 80, align: 'left', x: 52, width: 80, color: '#c9ada7' }), T('author', '{{author}}', { font: 'Lora', size: 3.6, y: 9, align: 'left', x: 52, width: 80, color: '#f2e9e4', upper: true, spacing: 0.25 }), T('tagline', '', { y: 94, size: 2.2 })],
    ornament: { show: false, style: 'line', color: '#c9ada7', y: 62 },
  }) },
  modern: { label: 'Modern', apply: (c) => Object.assign(c, {
    background: { ...c.background, type: 'gradient', color: '#ff7a59', color2: '#ffb347', angle: 135, overlay: 0 },
    layers: [T('title', '{{title}}', { font: 'Montserrat', weight: 700, size: 11, y: 44, align: 'left', x: 50, width: 82, color: '#1b1b1b', lineHeight: 1 }), T('subtitle', '{{subtitle}}', { font: 'Montserrat', size: 3, y: 60, align: 'left', x: 50, width: 82, color: '#1b1b1b' }), T('author', '{{author}}', { font: 'Montserrat', weight: 700, size: 3.6, y: 90, align: 'left', x: 50, width: 82, color: '#1b1b1b', upper: true, spacing: 0.15 }), T('tagline', '', { y: 10, size: 2.4, color: '#1b1b1b' })],
    ornament: { show: true, style: 'band', color: '#ffffff', y: 44 }, spine: { ...c.spine, color: '#1b1b1b' }, back: { ...c.back, textColor: '#1b1b1b' },
  }) },
  children: { label: "Children's", apply: (c) => Object.assign(c, {
    background: { ...c.background, type: 'gradient', color: '#ffd84d', color2: '#ff9f43', angle: 180, overlay: 0 },
    layers: [T('title', '{{title}}', { font: 'Abril Fatface', size: 12, y: 22, color: '#2b2d42', lineHeight: 1 }), T('subtitle', '{{subtitle}}', { font: 'Lato', size: 3.2, y: 37, color: '#2b2d42' }), T('author', '{{author}}', { font: 'Lato', weight: 700, size: 4, y: 90, color: '#2b2d42' }), T('tagline', '', { y: 96, size: 2.2, color: '#2b2d42' })],
    ornament: { show: false, style: 'dots', color: '#2b2d42', y: 44 }, spine: { ...c.spine, color: '#2b2d42', font: 'Lato' }, back: { ...c.back, textColor: '#2b2d42' },
  }) },
  nonfiction: { label: 'Non-fiction', apply: (c) => Object.assign(c, {
    background: { ...c.background, type: 'solid', color: '#ffffff', overlay: 0 },
    layers: [T('title', '{{title}}', { font: 'Merriweather', weight: 700, size: 9, y: 30, color: '#14213d', lineHeight: 1.1 }), T('subtitle', '{{subtitle}}', { font: 'Lato', size: 3.4, y: 47, color: '#3d405b' }), T('author', '{{author}}', { font: 'Lato', weight: 700, size: 4.2, y: 88, color: '#ffffff', upper: true, spacing: 0.12 }), T('tagline', '', { y: 10, size: 2.4, color: '#3d405b' })],
    ornament: { show: true, style: 'band', color: '#14213d', y: 88 }, spine: { ...c.spine, color: '#ffffff', color2: '#14213d' }, back: { ...c.back, color: '#14213d', textColor: '#ffffff' },
  }) },
};

