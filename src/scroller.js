import { select } from 'd3-selection';
import debounce from 'lodash-es/debounce.js';

export default class Scroller {
  constructor() {
    this._columns = 0;
    this._rows = 0;

    this._height = 0;
    this._width = 0;

    this._rootHeight = 0;
    this._rootWidth = 0;

    this._offset = 0;
    this._limit = 0;
    this._extra = 3;

    this._data = [];

    this._load = null;
    this._append = null;
    this._remove = null;

    this._elements = new Map();

    this._root = select('body')
      .append('div')
      .remove()
      .classed('scola scroller', true)
      .styles({
        'height': '100%',
        'overflow': 'auto',
        'position': 'absolute',
        'width': '100%'
      });

    this._rootNode = this._root.node();
    this._bind();
  }

  destroy() {
    this._unbind();
    this._root.dispatch('destroy');
    this._root.remove();
    this._root = null;
  }

  root() {
    return this._root;
  }

  append(append) {
    this._append = append;
    return this;
  }

  remove(remove) {
    this._remove = remove;
    return this;
  }

  columns(columns) {
    this._columns = columns;
    this._extra = 3 * columns;
    return this;
  }

  height(height) {
    this._height = height;
    return this;
  }

  rows(rows) {
    this._rows = rows;
    this._extra = 3 * rows;
    return this;
  }

  width(width) {
    this._width = width;
    return this;
  }

  start() {
    setTimeout(() => this._handleResize());
    return this;
  }

  load(range, data) {
    if (typeof range === 'function') {
      this._load = range;
      return this;
    }

    this._data.splice(range[0], data.length, ...data);
    this.render(range);

    return this;
  }

  clear() {
    this._data = [];
    this._elements.forEach((element) => {
      element.remove();
    });
    this._elements.clear();

    return this;
  }

  total(total) {
    this._total = total;
    this._data = new Array(total);

    if (!this._spanner) {
      this._spanner = this._root
        .append('div')
        .styles({
          'height': 1,
          'position': 'absolute',
          'width': 1
        });
    }

    if (this._columns) {
      const top = this._total / this._columns * this._height;
      this._spanner.style('top', top);
    } else if (this._rows) {
      const left = this._total / this._rows * this._width;
      this._spanner.style('left', left);
    }

    return this;
  }

  render(range) {
    for (let i = range[0]; i <= range[1]; i += 1) {
      const datum = this._data[i];

      if (!datum) {
        continue;
      }

      let element = null;
      let width = this._width;
      let height = this._height;
      let top = 0;
      let left = 0;

      if (this._columns) {
        height = this._height;
        width = 100 / this._columns;

        left = (i % this._columns) * width;
        top = Math.floor(i / this._columns) * height;

        left += '%';
        width += '%';
      } else if (this._rows) {
        height = 100 / this._rows;
        width = this._width;

        left = Math.floor(i / this._rows) * width;
        top = (i % this._rows) * height;

        height += '%';
        top += '%';
      }

      if (this._elements.has(datum)) {
        element = this._elements.get(datum);
      } else {
        element = this._append(datum);
      }

      element.styles({
        height,
        left,
        'position': 'absolute',
        top,
        width
      });

      this._elements.set(datum, element);
      this._rootNode.appendChild(element.node());
    }
  }

  _bind(delay = 25) {
    select(window).on('resize.scola-scroller',
      debounce(this._handleResize.bind(this), delay));
    this._root.on('scroll',
      debounce(this._handleScroll.bind(this), delay));
  }

  _unbind() {
    select(window).on('resize.scola-scroller', null);
    this._root.on('scroll', null);
  }

  _handleResize() {
    this._rootHeight = parseFloat(this._root.style('height'));
    this._rootWidth = parseFloat(this._root.style('width'));

    if (this._columns) {
      this._limit = Math.round(this._rootHeight / this._height) *
        this._columns;
    } else if (this._rows) {
      this._limit = Math.round(this._rootWidth / this._width) *
        this._rows;
    }

    this._handleScroll();
  }

  _handleScroll() {
    if (this._columns) {
      this._offset = Math.round(this._rootNode.scrollTop / this._height) *
        this._columns;
    } else if (this._rows) {
      this._offset = Math.round(this._rootNode.scrollLeft / this._width) *
        this._rows;
    }

    const elements = new Map(this._elements);
    const load = [];
    const render = [];

    let i = this._offset - this._extra;
    const max = this._offset + this._limit + this._extra;

    for (; i < max; i += 1) {
      if (i < 0 || i >= this._total) {
        continue;
      } else if (typeof this._data[i] === 'undefined') {
        load.push(i);
        continue;
      } else {
        render.push(i);
        elements.delete(this._data[i]);
      }
    }

    elements.forEach((element, datum) => {
      this._remove(datum, element);
      this._elements.delete(datum);
    });

    this.render(this._range(render).pop());

    if (load.length > 0) {
      this._load(this._range(load), this.load.bind(this));
    }
  }

  _range(numbers) {
    const ranges = [];

    let start = numbers.shift();
    let last = start;

    numbers.forEach((number) => {
      if (number !== last + 1) {
        ranges.push([start, last]);
        start = number;
      }

      last = number;
    });

    ranges.push([start, last]);

    return ranges;
  }
}
