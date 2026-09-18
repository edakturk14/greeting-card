const barcode = document.querySelector('#barcode');
let x = 0;
for (let i = 0; x < 174; i++) {
  const width = [2, 1, 3, 1, 2, 2, 1, 4, 1, 2, 1, 3][i % 12];
  const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bar.setAttribute('x', x); bar.setAttribute('width', width); bar.setAttribute('height', 44); bar.setAttribute('fill', '#232522');
  barcode.appendChild(bar); x += width + [1, 2, 1, 1, 3][i % 5];
}
const dialog = document.querySelector('#schedule');
document.querySelector('.schedule-button').addEventListener('click', () => dialog.showModal());
document.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) {const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
const confirmation = document.querySelector('#confirmation');
const overview = document.querySelector('#overview');
const back = document.querySelector('.back');
back.addEventListener('click', () => {confirmation.hidden=true;overview.hidden=false;back.hidden=true;document.querySelector('.return-button').focus();});
document.querySelector('.return-button').addEventListener('click', () => {confirmation.hidden=false;overview.hidden=true;back.hidden=false;document.querySelector('.schedule-button').focus();});
