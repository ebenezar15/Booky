// Ready-made content for every standard book page. Text inside {{ }} is filled
// from the Book Details at export time; paragraphs whose fields are all empty
// are dropped automatically, so the templates stay tidy.
const P = (text, cls = '', align = '') =>
  `<p${cls ? ` class="${cls}"` : ''}${align ? ` style="text-align: ${align}"` : ''}>${text}</p>`;

export const PAGE_TEMPLATES = {
  'half-title': { align: 'third', content: P('{{title}}', 'ps-display', 'center') },

  'series-title': {
    align: 'third',
    content: P('Also in the {{series}} series', 'ps-subtitle', 'center') + P('Book One', 'ps-noindent', 'center') + P('Book Two', 'ps-noindent', 'center'),
  },

  'also-by': {
    title: 'Also by {{author}}',
    content: P('<em>Title of Book</em>', 'ps-noindent', 'center') + P('<em>Title of Book</em>', 'ps-noindent', 'center') + P('<em>Title of Book</em>', 'ps-noindent', 'center'),
  },

  frontispiece: { align: 'center', content: P('Add an illustration here (Insert → Image).', 'ps-caption', 'center') },

  title: {
    align: 'third',
    content:
      P('{{title}}', 'ps-display', 'center') +
      P('{{subtitle}}', 'ps-subtitle', 'center') +
      P('', 'ps-spacer') +
      P('{{author}}', 'ps-author', 'center') +
      P('', 'ps-spacer') +
      P('{{publisher}}', 'ps-small', 'center') +
      P('{{publisherCity}}', 'ps-small', 'center'),
  },

  copyright: {
    align: 'bottom',
    content:
      P('{{title}}', 'ps-small') +
      P('Copyright © {{year}} by {{copyrightHolder}}', 'ps-small') +
      P('All rights reserved. No part of this book may be reproduced, stored in a retrieval system, or transmitted in any form or by any means — electronic, mechanical, photocopying, recording or otherwise — without the prior written permission of the publisher, except for the use of brief quotations in a book review.', 'ps-small') +
      P('This is a work of fiction. Names, characters, businesses, places, events and incidents are either the products of the author’s imagination or used in a fictitious manner. Any resemblance to actual persons, living or dead, or actual events is purely coincidental.', 'ps-small') +
      P('ISBN {{isbnPrint}} (paperback)', 'ps-small') +
      P('ISBN {{isbnEbook}} (ebook)', 'ps-small') +
      P('Edited by {{editor}}', 'ps-small') +
      P('Cover design by {{coverDesigner}}', 'ps-small') +
      P('Illustrations by {{illustrator}}', 'ps-small') +
      P('Published by {{publisher}}, {{publisherCity}}', 'ps-small') +
      P('{{publisherWebsite}}', 'ps-small') +
      P('{{edition}}', 'ps-small'),
  },

  dedication: { align: 'third', content: P('<em>For the ones who believed in this story before it was written.</em>', 'ps-noindent', 'center') },

  epigraph: {
    align: 'third',
    content:
      P('<em>“Not all those who wander are lost.”</em>', 'ps-epigraph', 'center') +
      P('— Author Name, <em>Source</em>', 'ps-attribution', 'right'),
  },

  toc: { title: 'Contents', content: '' },

  'list-figures': { title: 'Illustrations', content: P('Figure 1 — Caption', 'ps-noindent') },

  foreword: { title: 'Foreword', content: P('A foreword is usually written by someone other than the author, introducing the book and its author to the reader.', 'ps-noindent') + P('— Name of Foreword Writer', 'ps-attribution', 'right') },
  preface: { title: 'Preface', content: P('In the preface, tell the reader how and why this book came to be.', 'ps-noindent') },
  introduction: { title: 'Introduction', content: P('Set the stage for the reader: what this book covers and how to read it.', 'ps-noindent') },
  prologue: { title: 'Prologue', content: P('', 'ps-noindent') },
  part: { title: 'Part Title', content: '' },
  chapter: { title: '', content: P('', 'ps-noindent') },
  interlude: { title: 'Interlude', content: P('', 'ps-noindent') },
  epilogue: { title: 'Epilogue', content: P('', 'ps-noindent') },
  afterword: { title: 'Afterword', content: P('', 'ps-noindent') },

  acknowledgments: {
    title: 'Acknowledgments',
    content: P('No book is written alone. Thank you to my editor, {{editor}}, for making this story sharper; to my family for their patience; and to you, the reader, for picking up this book.', 'ps-noindent'),
  },

  appendix: { title: 'Appendix', content: P('', 'ps-noindent') },
  glossary: { title: 'Glossary', content: P('<strong>Term</strong> — Definition of the term.', 'ps-hanging') + P('<strong>Term</strong> — Definition of the term.', 'ps-hanging') },
  endnotes: { title: 'Notes', content: P('1. Note text.', 'ps-hanging') },
  bibliography: { title: 'Bibliography', content: P('Author, A. <em>Title of Work</em>. City: Publisher, Year.', 'ps-hanging') },
  index: { title: 'Index', content: P('<strong>A</strong>', 'ps-noindent') + P('Apple, 12, 45', 'ps-hanging') },

  'about-author': {
    title: 'About the Author',
    content: P('{{authorBio}}', 'ps-noindent') + P('{{author}} lives and writes in a small town by the sea. Learn more at {{website}}.', 'ps-noindent'),
  },

  'book-club': {
    title: 'Reading Group Guide',
    content: '<ol><li><p>Which character did you identify with most, and why?</p></li><li><p>How did the setting shape the story?</p></li><li><p>What do you think happens after the final chapter?</p></li></ol>',
  },

  excerpt: { title: 'A Sneak Peek', content: P('<em>Turn the page for an excerpt from the next book…</em>', 'ps-noindent', 'center') },

  newsletter: {
    title: 'Thank You for Reading',
    content: P('If you enjoyed this book, please consider leaving a review — it helps other readers discover it.', 'ps-noindent', 'center') + P('Join the newsletter for news and free stories: {{website}}', 'ps-noindent', 'center'),
  },

  colophon: { align: 'bottom', content: P('This book was set in its typefaces and designed with Booky.', 'ps-small', 'center') },

  blank: { content: '' },

  custom: { title: 'New Page', content: P('', 'ps-noindent') },
};
