import { select } from 'd3-selection';
import debounce from 'lodash-es/debounce.js';

export default class Scroller {
  constructor() {
    this._columns = 0;
    this._rows = 0;

    this._extraBase = 1;
    this._extra = 1;

    this._empty = null;
    this._header = null;
    this._item = null;
    this._load = null;

    this._rootHeight = 0;
    this._rootWidth = 0;

    this._headerHeight = 32;
    this._headerWidth = 32;

    this._itemHeight = 48;
    this._itemWidth = 48;

    this._offset = 0;
    this._limit = 0;
    this._total = 0;

    this._data = [];
    this._groups = [];

    this._filterActive = false;
    this._stashData = null;
    this._stashGroups = null;
    this._stashTotal = null;

    this._emptyItem = null;
    this._items = new Map();
    this._headers = new Map();

    this._root = select('body')
      .append('div')
      .remove()
      .classed('scola scroller', true)
      .styles({
        'display': 'flex',
        'flex': 1,
        'overflow': 'auto',
        'position': 'relative',
        '-webkit-overflow-scrolling': 'touch'
      });

    this._spanner = this._root
      .append('div')
      .styles({
        'height': 1,
        'position': 'absolute',
        'width': 1
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

  columns(columns) {
    if (typeof columns === 'undefined') {
      return this._columns;
    }

    this._columns = columns;
    this._extra = this._extraBase * columns;

    return this;
  }

  rows(rows) {
    if (typeof rows === 'undefined') {
      return this._rows;
    }

    this._rows = rows;
    this._extra = this._extraBase * rows;

    return this;
  }

  extra(extra) {
    if (typeof extra === 'undefined') {
      return this._extraBase;
    }

    this._extraBase = extra;
    return this;
  }

  empty(empty) {
    this._empty = empty;
    return this;
  }

  header(header) {
    this._header = header;
    return this;
  }

  item(item) {
    this._item = item;
    return this;
  }

  height(itemHeight, headerHeight) {
    if (typeof itemHeight === 'undefined') {
      return [this._itemHeight, this._headerHeight];
    }

    const calculator = select('body').append('div');

    this._itemHeight = parseFloat(calculator
      .style('height', itemHeight)
      .style('height'));

    if (headerHeight) {
      this._headerHeight = parseFloat(calculator
        .style('height', headerHeight)
        .style('height'));
    }

    calculator.remove();
    return this;
  }

  width(itemWidth, headerWidth) {
    if (typeof itemWidth === 'undefined') {
      return [this._itemWidth, this._headerWidth];
    }

    const calculator = select('body').append('div');

    this._itemWidth = parseFloat(calculator
      .style('height', itemWidth)
      .style('height'));

    if (headerWidth) {
      this._headerWidth = parseFloat(calculator
        .style('height', headerWidth)
        .style('height'));
    }

    calculator.remove();
    return this;
  }

  start() {
    setTimeout(() => this._handleResize());
    return this;
  }

  clear() {
    this._items.forEach((item) => {
      item.destroy();
    });
    this._items.clear();

    this._headers.forEach((header) => {
      header.destroy();
    });
    this._headers.clear();

    return this;
  }

  groups(groups) {
    this._groups = groups;

    let total = 0;

    this._groups.forEach((group) => {
      total += group.range[1] - group.range[0] + 1;
    });

    this.total(total);

    return this;
  }

  filter(filter) {
    if (typeof filter === 'function') {
      this._filter = filter;
      return this;
    }

    this.clear();

    if (filter === false) {
      if (this._stashTotal) {
        this._groups = this._stashGroups;
        this._stashGroups = null;

        this.total(this._stashTotal);
        this._stashTotal = null;

        this._data = this._stashData;
        this._stashData = null;
      }

      if (this._offset <= 0) {
        this._handleScroll();
      } else if (this.columns) {
        this._root.node().scrollTop = 0;
      } else {
        this._root.node().scrollLeft = 0;
      }

      return this;
    }

    this._filterActive = true;

    if (this._stashTotal === null) {
      this._stashData = this._data;
      this._stashGroups = this._groups;
      this._stashTotal = this._total;
    }

    this._data = this._data.filter(this._filter.bind(null, filter));
    this._groups = [];

    if (this._offset <= 0) {
      this._handleScroll(false);
    } else if (this.columns) {
      this._root.node().scrollTop = 0;
    } else {
      this._root.node().scrollLeft = 0;
    }

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

  total(total) {
    this._total = total;
    this._data = new Array(total);

    if (this._columns) {
      let top = this._total / this._columns * this._itemHeight;
      top += this._groups.length * 32;
      this._spanner.style('top', top);
    } else if (this._rows) {
      let left = this._total / this._rows * this._itemWidth;
      left += this._groups.length * 32;
      this._spanner.style('left', left);
    }

    return this;
  }

  render(range) {
    if (this._data.length === 0) {
      if (!this._emptyItem) {
        this._emptyItem = this._empty();
        this._root.node().appendChild(this._emptyItem.root().node());
      }
    } else if (this._emptyItem) {
      this._emptyItem.destroy();
      this._emptyItem = null;
    }

    for (let i = range[0]; i <= range[1]; i += 1) {
      const datum = this._data[i];

      if (!datum) {
        continue;
      }

      const groupIndex = this._group(i);

      let header = null;
      let item = null;

      let width = 0;
      let height = 0;

      let top = 0;
      let left = 0;

      if (this._items.has(datum)) {
        item = this._items.get(datum);
      } else {
        item = this._item(datum, i);
        this._items.set(datum, item);
      }

      if (this._columns) {
        width = 100 / this._columns;

        left = (i % this._columns) * width;
        top = Math.floor(i / this._columns) * this._itemHeight;
        top += (groupIndex + 1) * this._headerHeight;

        left += '%';
        width += '%';

        item.root().styles({
          height: this._itemHeight,
          left,
          'position': 'absolute',
          top,
          width
        });
      } else if (this._rows) {
        height = 100 / this._rows;

        left = Math.floor(i / this._rows) * this._itemWidth;
        left += (groupIndex + 1) * this._headerWidth;
        top = (i % this._rows) * height;

        height += '%';
        top += '%';

        item.root().styles({
          height,
          left,
          'position': 'absolute',
          top
        });
      }

      if (groupIndex !== -1 && this._groups[groupIndex].range[0] === i) {
        header = this._header(this._groups[groupIndex]);

        if (this._columns) {
          item.top();

          header.root().styles({
            'position': 'absolute',
            'top': top - 32,
            width
          });
        } else if (this._rows) {
          item.left();

          header.root().styles({
            height,
            'left': left - 32,
            'position': 'absolute'
          });
        }

        this._headers.set(this._groups[groupIndex], header);
        this._rootNode.appendChild(header.root().node());
      } else if (this._columns && i < this._columns) {
        item.top();
      } else if (this._rows && i < this._rows) {
        item.left();
      }

      this._rootNode.appendChild(item.root().node());
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
      this._limit = Math.round(this._rootHeight / this._itemHeight) *
        this._columns;
    } else if (this._rows) {
      this._limit = Math.round(this._rootWidth / this._itemWidth) *
        this._rows;
    }

    this._handleScroll();
  }

  _handleScroll() {
    if (this._columns) {
      this._offset = this._offsetTop(this._rootNode.scrollTop);
    } else if (this._rows) {
      this._offset = this._offsetLeft(this._rootNode.scrollLeft);
    }

    const items = new Map(this._items);
    const loadItems = [];
    const renderItems = [];

    let i = this._offset - this._extra;
    const max = this._offset + this._limit + this._extra;

    for (; i < max; i += 1) {
      if (i < 0 || i >= this._total) {
        continue;
      } else if (typeof this._data[i] === 'undefined') {
        loadItems.push(i);
        continue;
      } else {
        renderItems.push(i);
        items.delete(this._data[i]);
      }
    }

    items.forEach((item, datum) => {
      item.destroy();
      this._items.delete(datum);
    });

    this._headers.forEach((header, group) => {
      header.destroy();
      this._headers.delete(group);
    });

    this.render(this._range(renderItems));

    if (this._filterActive) {
      this._filterActive = false;
    } else if (loadItems.length > 0) {
      this._load(this._range(loadItems), this.load.bind(this));
    }
  }

  _offsetTop(offset) {
    let top = 0;
    let bottom = 0;

    for (let i = 0; i < this._groups.length; i += 1) {
      top = (this._groups[i].range[0] * this._itemHeight) +
        (i * this._headerHeight);
      bottom = ((this._groups[i].range[1] + 1) * this._itemHeight) +
        ((i + 1) * this._headerHeight);

      if (offset >= top && offset <= bottom) {
        return this._groups[i].range[0] +
          Math.floor((offset - top - this._headerHeight) /
            this._itemHeight);
      }
    }

    return Math.floor(offset / this._itemHeight) * this._columns;
  }

  _offsetLeft(offset) {
    let left = 0;
    let right = 0;

    for (let i = 0; i < this._groups.length; i += 1) {
      left = (this._groups[i].range[0] * this._itemWidth) +
        (i * this._headerWidth);
      right = ((this._groups[i].range[1] + 1) * this._itemWidth) +
        ((i + 1) * this._headerWidth);

      if (offset >= left && offset <= right) {
        return this._groups[i].range[0] +
          Math.floor((offset - left - this._headerWidth) /
            this._itemWidth);
      }
    }

    return Math.floor(offset / this._itemWidth) * this._rows;
  }

  _group(index) {
    for (let i = 0; i < this._groups.length; i += 1) {
      if (index >= this._groups[i].range[0] &&
        index <= this._groups[i].range[1]) {

        return i;
      }
    }

    return -1;
  }

  _range(numbers) {
    return [numbers[0], numbers[numbers.length - 1]];
  }
}
