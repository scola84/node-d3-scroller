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
    this._scroll = null;

    this._rootHeight = 0;
    this._rootWidth = 0;

    this._headerHeight = 32;
    this._headerWidth = 32;

    this._itemHeight = 48;
    this._itemWidth = 48;

    this._offset = 0;
    this._limit = 0;
    this._total = 0;

    this._data = {};
    this._groups = [];

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

  items() {
    return this._items;
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

  offset(offset) {
    if (typeof offset === 'undefined') {
      return this._offset;
    }

    this._offset = offset;

    if (this._columns) {
      this._rootNode.scrollTop = this._scrollTop(offset);
    } else if (this._rows) {
      this._rootNode.scrollLeft = this._scrollLeft(offset);
    }

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

  scroll(scroll) {
    this._scroll = scroll;
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
    this._handleResize();
    return this;
  }

  clear() {
    this._items.forEach((item) => {
      item.destroy();
    });

    this._headers.forEach((header) => {
      header.destroy();
    });

    this._items.clear();
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

    if (filter === null) {
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

    if (this._stashTotal === null) {
      this._stashData = this._data;
      this._stashGroups = this._groups;
      this._stashTotal = this._total;
    }

    const data = {};
    let index = 0;

    Object.keys(this._data).forEach((key) => {
      if (this._filter(filter, this._data[key]) === false) {
        delete this._data[key];
      } else {
        data[index] = this._data[key];
        index += 1;
      }
    });

    this._data = data;
    this._groups = [];

    if (this._offset <= 0) {
      this._handleScroll();
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

    let index = range[0];

    data.forEach((datum) => {
      this._data[index] = datum;
      index += 1;
    });

    this.render(range);

    return this;
  }

  total(total) {
    this._total = total;
    let name = '';
    let value = 0;

    if (this._columns) {
      name = 'top';
      value = (this._total / this._columns * this._itemHeight) +
        this._groups.length * this._headerHeight -
        1;
    } else if (this._rows) {
      name = 'left';
      value = this._total / this._rows * this._itemWidth +
        this._groups.length * this._headerWidth -
        1;
    }

    this._spanner.style(name, value);
    return this;
  }

  render(range) {
    if (Object.keys(this._data).length === 0) {
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

        const next = this._find(i);

        if (next) {
          this._rootNode.insertBefore(item.root().node(),
            next.root().node());
        } else {
          this._rootNode.appendChild(item.root().node());
        }
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
          top,
          width: this._itemWidth
        });
      }

      if (groupIndex !== -1 && this._groups[groupIndex].range[0] === i) {
        header = this._header(this._groups[groupIndex]);

        if (this._columns) {
          item.top();

          header.root().styles({
            'position': 'absolute',
            'top': top - this._headerHeight,
            width
          });
        } else if (this._rows) {
          item.left();

          header.root().styles({
            height,
            'left': left - this._headerWidth,
            'position': 'absolute'
          });
        }

        this._headers.set(this._groups[groupIndex], header);
        this._rootNode.insertBefore(header.root().node(),
          item.root().node());
      } else if (this._columns && i < this._columns) {
        item.top();
      } else if (this._rows && i < this._rows) {
        item.left();
      }
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

    let i = Math.max(0, this._offset - this._extra);
    const max = Math.min(this._total,
      this._offset + this._limit + this._extra);

    for (; i < max; i += 1) {
      if (typeof this._data[i] === 'undefined') {
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

    if (loadItems.length > 0) {
      this._load(this._range(loadItems), (range, data) => {
        this.load(range, data);
        this._handleScrollEnd();
      });
    } else {
      this._handleScrollEnd();
    }
  }

  _handleScrollEnd() {
    if (this._scroll) {
      this._scroll();
    }
  }

  _offsetTop(scroll) {
    let top = 0;
    let bottom = 0;

    for (let i = 0; i < this._groups.length; i += 1) {
      top = (this._groups[i].range[0] * this._itemHeight) +
        (i * this._headerHeight);
      bottom = ((this._groups[i].range[1] + 1) * this._itemHeight) +
        ((i + 1) * this._headerHeight);

      if (scroll >= top && scroll <= bottom) {
        return Math.max(0, this._groups[i].range[0] +
          Math.round((scroll - top - this._headerHeight) /
            this._itemHeight));
      }
    }

    return Math.round(scroll / this._itemHeight) * this._columns;
  }

  _offsetLeft(scroll) {
    let left = 0;
    let right = 0;

    for (let i = 0; i < this._groups.length; i += 1) {
      left = (this._groups[i].range[0] * this._itemWidth) +
        (i * this._headerWidth);
      right = ((this._groups[i].range[1] + 1) * this._itemWidth) +
        ((i + 1) * this._headerWidth);

      if (scroll >= left && scroll <= right) {
        return this._groups[i].range[0] +
          Math.floor((scroll - left - this._headerWidth) /
            this._itemWidth);
      }
    }

    return Math.floor(scroll / this._itemWidth) * this._rows;
  }

  _scrollTop(offset) {
    let top = 0;

    for (let i = 0; i < this._groups.length; i += 1) {
      top = (this._groups[i].range[0] * this._itemHeight) +
        (i * this._headerHeight);

      if (offset >= this._groups[i].range[0] &&
        offset <= this._groups[i].range[1]) {

        if (offset > 0) {
          top += ((offset - this._groups[i].range[0]) *
            this._itemHeight) + this._headerHeight;
        }

        if (offset !== this._groups[i].range[0]) {
          top += 1;
        }

        return top;
      }
    }

    return (offset * this._itemHeight) + (offset === 0 ? 0 : 1);
  }

  _scrollLeft(offset) {
    let left = 0;

    for (let i = 0; i < this._groups.length; i += 1) {
      left = (this._groups[i].range[0] * this._itemWidth) +
        (i * this._headerWidth);

      if (offset >= this._groups[i].range[0] &&
        offset <= this._groups[i].range[1]) {

        if (offset > 0) {
          left += ((offset - this._groups[i].range[0]) *
            this._itemWidth) + this._headerWidth;
        }

        if (offset !== this._groups[i].range[0]) {
          left += 1;
        }

        return left;
      }
    }

    return (offset * this._itemWidth) + (offset === 0 ? 0 : 1);
  }

  _find(index) {
    index += 1;

    for (; index < this._total; index += 1) {
      if (this._items.has(this._data[index])) {
        return this._items.get(this._data[index]);
      }
    }

    return null;
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
