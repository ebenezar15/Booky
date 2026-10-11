// Appearance controls: light/sepia/dark, colour scheme presets, custom colours, sidebar style.
import { h, add, clear, segmented, popover, iconBtn, color } from './dom.js';
import { state, setApp } from '../core/store.js';
import { COLOR_SCHEMES, schemeColors } from '../core/colors.js';

export function appearancePanel() {
  const wrap = h('div.appearance');
  const draw = () => {
    clear(wrap);
    const sw = (id, c) => h(`button.scheme${state.app.colorScheme === id ? '.on' : ''}`, {
      type: 'button', title: c.label, 'aria-label': c.label,
      style: { background: `linear-gradient(135deg, ${c.primary}, ${c.accent})` },
      on: { click: () => { setApp({ colorScheme: id }); draw(); } },
    });
    const cur = schemeColors(state.app);
    add(wrap,
      h('div.field-label', 'Mode'),
      segmented([['light', 'Light'], ['sepia', 'Sepia'], ['dark', 'Dark']], state.app.theme, (v) => setApp({ theme: v })),
      h('div.field-label', { style: { marginTop: '14px' } }, 'Colour scheme'),
      h('div.schemes', Object.entries(COLOR_SCHEMES).map(([id, c]) => sw(id, c)),
        h(`button.scheme.custom${state.app.colorScheme === 'custom' ? '.on' : ''}`, { type: 'button', title: 'Custom colours', on: { click: () => { setApp({ colorScheme: 'custom' }); draw(); } } }, '+')),
      h('div.small.muted', { style: { margin: '6px 0 0' } }, state.app.colorScheme === 'custom' ? 'Custom' : (COLOR_SCHEMES[state.app.colorScheme] || COLOR_SCHEMES.cadenza).label),
      state.app.colorScheme === 'custom' ? h('div.row', { style: { marginTop: '10px', gap: '14px' } },
        h('span.row', color(state.app.customPrimary, (v) => setApp({ customPrimary: v })), h('span.small', 'Main')),
        h('span.row', color(state.app.customAccent, (v) => setApp({ customAccent: v })), h('span.small', 'Accent'))) : null,
      h('div.field-label', { style: { marginTop: '14px' } }, 'Sidebar'),
      segmented([['deep', 'Deep colour'], ['light', 'Light']], state.app.sidebar === 'light' ? 'light' : 'deep', (v) => setApp({ sidebar: v })),
      h('div.scheme-preview', { style: { background: `linear-gradient(160deg, ${cur.deep}, ${cur.deep2})` } },
        h('span', { style: { background: `linear-gradient(135deg, ${cur.primary}, ${cur.accent})` } }), h('i'), h('i'), h('i')),
    );
  };
  draw();
  return wrap;
}

export function appearanceButton() {
  return iconBtn('palette', 'Appearance & colours', (e) => {
    popover(e.currentTarget.getBoundingClientRect(), h('div', { style: { width: '280px' } }, h('b', 'Appearance'), h('div', { style: { height: '8px' } }), appearancePanel()));
  });
}
