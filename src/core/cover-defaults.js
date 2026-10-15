// Cover designer default state. Positions are percentages of the front cover.
export function defaultCover() {
  return {
    template: 'classic',
    background: {
      type: 'gradient', // solid | gradient | image
      color: '#1f2a44',
      color2: '#4b3f72',
      angle: 160,
      image: '',
      imageFit: 'cover',
      overlay: 0.25,
      overlayColor: '#000000',
    },
    layers: [
      { id: 'title', kind: 'text', text: '{{title}}', font: 'Playfair Display', size: 9, weight: 700, italic: false, color: '#ffffff', align: 'center', x: 50, y: 30, width: 84, upper: false, spacing: 0, shadow: true, lineHeight: 1.1, visible: true },
      { id: 'subtitle', kind: 'text', text: '{{subtitle}}', font: 'Lora', size: 3.4, weight: 400, italic: true, color: '#e7e2f5', align: 'center', x: 50, y: 46, width: 80, upper: false, spacing: 0, shadow: false, lineHeight: 1.2, visible: true },
      { id: 'author', kind: 'text', text: '{{author}}', font: 'Montserrat', size: 3.8, weight: 700, italic: false, color: '#ffffff', align: 'center', x: 50, y: 88, width: 84, upper: true, spacing: 0.25, shadow: false, lineHeight: 1.1, visible: true },
      { id: 'tagline', kind: 'text', text: '', font: 'Lora', size: 2.4, weight: 400, italic: true, color: '#f3d9a4', align: 'center', x: 50, y: 10, width: 80, upper: false, spacing: 0, shadow: false, lineHeight: 1.2, visible: true },
    ],
    ornament: { show: true, style: 'line', color: '#f3d9a4', y: 54 },
    back: {
      blurb: '',
      color: '',
      textColor: '#ffffff',
      font: 'Lora',
      size: 11,
      showBarcodeBox: true,
      barcodeMode: 'barcode', // barcode = print the ISBN barcode · reserve = leave a white area for the printer
      addon: true, // EAN-5 price add-on (90000 when no price)
      price: '',
    },
    spine: { show: true, font: 'Montserrat', color: '#ffffff', textOverride: '' },
    paper: 'cream', // white | cream | color
    ebookSize: { w: 1600, h: 2560 },
    pageCountOverride: 0,
    // a finished cover designed elsewhere: front (ebook + print front) and an optional full print wrap
    imported: { front: '', wrap: '' },
  };
}
