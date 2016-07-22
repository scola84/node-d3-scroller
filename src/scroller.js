import { select } from 'd3-selection';
import debounce from 'lodash-es/debounce.js';
import throttle from 'lodash-es/throttle.js';

export default class Scroller {
  constructor() {
    this._model = null;

    this._columns = 0;
    this._rows = 0;

    this._extraBase = 1;
    this._extra = 1;

    this._bodyHeight = 0;
    this._bodyWidth = 0;

    this._headerHeight = 32;
    this._headerWidth = 32;

    this._itemHeight = 48;
    this._itemWidth = 48;

    this._direction = 1;

    this._offset = 0;
    this._count = 0;

    this._callbacks = {};

    this._message = null;
    this._headers = new Map();
    this._items = new Map();

    this._pages = new Map();

    this._handleResize = (e) => this._resize(e);
    this._handleScroll = (e) => this._scroll(e);

    this._window = select(window);

    this._root = select('body')
      .append('div')
      .remove()
      .classed('scola scroller', true)
      .styles({
        'display': 'flex',
        'flex-direction': 'column',
        'height': '100%',
        'position': 'absolute',
        'width': '100%'
      });

    this._body = this._root
      .append('div')
      .classed('scola body', true)
      .styles({
        'flex': 1,
        'order': 2,
        'overflow': 'auto',
        'position': 'relative',
        '-webkit-overflow-scrolling': 'touch'
      });

    this._span = this._body
      .append('div')
      .styles({
        'height': 1,
        'position': 'absolute',
        'width': 1
      });

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

  headers() {
    return this._headers;
  }

  items() {
    return this._items;
  }

  model(model) {
    if (typeof model === 'undefined') {
      return this._model;
    }

    this._model = model;
    return this;
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

  direction(direction) {
    this._body.attr('dir', direction);
    this._direction = direction === 'rtl' ? -1 : 1;

    return this;
  }

  empty(empty) {
    this._callbacks.empty = empty;
    return this;
  }

  header(header) {
    this._callbacks.header = header;
    return this;
  }

  item(item) {
    this._callbacks.item = item;
    return this;
  }

  scroll(scroll) {
    this._callbacks.scroll = scroll;
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

  offset(offset) {
    if (typeof offset === 'undefined') {
      return this._offset;
    }

    const lastOffset = this._offset;
    this._offset = offset;

    if (lastOffset === 0 && offset === 0) {
      this._scroll();
    } else if (this._columns) {
      this._body.node().scrollTop = this._scrollTop(offset);
    } else if (this._rows) {
      this._body.node().scrollLeft = this._scrollLeft(offset);
    }

    return this;
  }

  count(action) {
    if (typeof action === 'undefined') {
      return this._count;
    }

    this._bodyHeight = parseFloat(this._body.style('height'));
    this._bodyWidth = parseFloat(this._body.style('width'));

    if (this._columns) {
      this._count = Math.round(this._bodyHeight / this._itemHeight) *
        this._columns;
    } else if (this._rows) {
      this._count = Math.round(this._bodyWidth / this._itemWidth) *
        this._rows;
    }

    return this;
  }

  span(action) {
    if (typeof action === 'undefined') {
      return this._span;
    }

    let name = '';
    let value = 0;

    if (this._columns) {
      name = 'top';
      value = (this._model.total() / this._columns * this._itemHeight) +
        (this._model.groups().length * this._headerHeight) - 1;
    } else if (this._rows) {
      name = 'left';
      value = this._model.total() / this._rows * this._itemWidth +
        (this._model.groups().length * this._headerWidth) - 1;

      if (this._direction === -1) {
        value -= this._body.node().offsetWidth;
        value *= -1;
      }
    }

    this._span.style(name, value);
    return this;
  }

  clear() {
    if (this._message) {
      this._message.destroy();
      this._message = null;
    }

    this._items.forEach((item) => {
      item.destroy();
    });

    this._headers.forEach((header) => {
      header.destroy();
    });

    this._pages.clear();
    this._items.clear();
    this._headers.clear();

    return this;
  }

  _bind(delay = 25) {
    this._window.on('resize.scola-scroller',
      debounce(this._handleResize, delay));
    this._body.on('scroll.scola-scroller',
      debounce(this._handleScroll, delay));
  }

  _unbind() {
    this._window.on('resize.scola-scroller', null);
    this._body.on('scroll.scola-scroller', null);
  }

  _resize() {
    this.count(true);
    this._scroll();
  }

  _scroll() {
    if (this._columns) {
      this._offset = this._offsetTop(this._body.node().scrollTop);
    } else if (this._rows) {
      this._offset = this._offsetLeft(this._body.node().scrollLeft);
    }

    const count = this._model.count();

    const items = new Map(this._items);
    const pages = new Map(this._pages);
    const loadPages = new Set();

    const loadItems = [];
    const renderItems = [];

    let i = Math.max(0, this._offset - this._extra);
    const max = Math.min(this._model.total(),
      this._offset + this._count + this._extra);

    let pageIndex = 0;
    let datumIndex = 0;

    for (; i < max; i += 1) {
      pageIndex = Math.floor(i / count);
      datumIndex = i % count;

      if (pages.has(pageIndex) === false) {
        loadItems.push(i);
        loadPages.add(pageIndex);
      } else {
        renderItems.push(i);
        items.delete(pages.get(pageIndex)[datumIndex]);
        pages.delete(pageIndex);
      }
    }

    pages.forEach((page, index) => {
      this._pages.delete(index);
    });

    items.forEach((item, datum) => {
      item.destroy();
      this._items.delete(datum);
    });

    this._headers.forEach((header, group) => {
      header.destroy();
      this._headers.delete(group);
    });

    this._render(this._range(renderItems));

    if (loadPages.size > 0) {
      this._load(loadPages, loadItems);
      return;
    }

    if (this._callbacks.scroll) {
      this._callbacks.scroll();
    }
  }

  _load(pages, items) {
    let loaded = 0;

    pages.forEach((index) => {
      this._model.page(index).select((data) => {
        this._pages.set(index, data);
        loaded += 1;

        if (loaded === pages.size) {
          this._render(this._range(items));

          if (this._callbacks.scroll) {
            this._callbacks.scroll();
          }
        }
      });
    });
  }

  _render(range) {
    const count = this._model.count();

    let pageIndex = 0;
    let datumIndex = 0;

    let page = null;
    let datum = null;

    for (let i = range[0]; i <= range[1]; i += 1) {
      pageIndex = Math.floor(i / count);
      page = this._pages.get(pageIndex);

      if (typeof page === 'undefined') {
        continue;
      }

      datumIndex = i % count;
      datum = page[datumIndex];

      const groupIndex = this._group(i);
      const style = this._direction === -1 ? 'right' : 'left';

      let header = null;
      let item = null;

      let width = 0;
      let height = 0;

      let top = 0;
      let left = 0;

      if (this._items.has(datum)) {
        item = this._items.get(datum);
      } else {
        item = this._callbacks.item(datum, i);
        this._items.set(datum, item);

        const next = this._find(i, count);

        if (next) {
          this._body.node().insertBefore(item.root().node(),
            next.root().node());
        } else {
          this._body.node().appendChild(item.root().node());
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
          [style]: left,
          'position': 'absolute',
          top,
          width: this._itemWidth
        });
      }

      const groups = this._model.groups();

      if (groupIndex !== -1 && groups[groupIndex].begin === i) {
        header = this._callbacks.header(groups[groupIndex]);
        item.first();

        if (this._columns) {
          header.root().styles({
            'left': 0,
            'position': 'absolute',
            'top': top - this._headerHeight,
            width
          });
        } else if (this._rows) {
          header.root().styles({
            height,
            [style]: left - this._headerWidth,
            'position': 'absolute',
            'top': 0
          });
        }

        this._headers.set(groups[groupIndex], header);
        this._body.node().insertBefore(header.root().node(),
          item.root().node());
      } else if ((this._columns && i < this._columns) ||
        (this._rows && i < this._rows)) {

        item.first();
      }
    }

    if (this._items.size === 0) {
      if (!this._message) {
        this._message = this._callbacks.empty();
        this._body.node().appendChild(this._message.root().node());
      }
    } else if (this._message) {
      this._message.destroy();
      this._message = null;
    }
  }

  _offsetTop(scroll) {
    const groups = this._model.groups();

    let top = 0;
    let bottom = 0;

    for (let i = 0; i < groups.length; i += 1) {
      top = (groups[i].begin * this._itemHeight) +
        (i * this._headerHeight);
      bottom = ((groups[i].end + 1) * this._itemHeight) +
        ((i + 1) * this._headerHeight);

      if (scroll >= top && scroll <= bottom) {
        return Math.max(0, groups[i].begin +
          Math.round((scroll - top - this._headerHeight) / this._itemHeight));
      }
    }

    return Math.round(scroll / this._itemHeight) * this._columns;
  }

  _offsetLeft(scroll) {
    scroll = this._normalize(scroll);

    const groups = this._model.groups();

    let left = 0;
    let right = 0;

    for (let i = 0; i < groups.length; i += 1) {
      left = (groups[i].begin * this._itemWidth) +
        (i * this._headerWidth);
      right = ((groups[i].end + 1) * this._itemWidth) +
        ((i + 1) * this._headerWidth);

      if (scroll >= left && scroll <= right) {
        return Math.max(0, groups[i].begin +
          Math.round((scroll - left - this._headerWidth) /
            this._itemWidth));
      }
    }

    return Math.round(scroll / this._itemWidth) * this._rows;
  }

  _scrollTop(offset) {
    const groups = this._model.groups();

    let top = 0;

    for (let i = 0; i < groups.length; i += 1) {
      top = (groups[i].begin * this._itemHeight) + (i * this._headerHeight);

      if (offset >= groups[i].begin && offset <= groups[i].end) {
        if (offset > 0) {
          top += ((offset - groups[i].begin) * this._itemHeight) +
            this._headerHeight;
        }

        if (offset !== groups[i].begin) {
          top += 1;
        }

        return top;
      }
    }

    return (offset * this._itemHeight) + (offset === 0 ? 0 : 1);
  }

  _scrollLeft(offset) {
    const groups = this._model.groups();

    let left = 0;

    for (let i = 0; i < groups; i += 1) {
      left = (groups[i].begin * this._itemWidth) + (i * this._headerWidth);

      if (offset >= groups[i].begin && offset <= groups[i].end) {
        if (offset > 0) {
          left += ((offset - groups[i].begin) * this._itemWidth) +
            this._headerWidth;
        }

        if (offset !== groups[i].begin) {
          left += 1;
        }

        break;
      }
    }

    if (left === 0) {
      left = (offset * this._itemWidth) + (offset === 0 ? 0 : 1);
    }

    return this._normalize(left);
  }

  _find(index, count) {
    index += 1;

    let pageIndex = 0;
    let datumIndex = 0;

    let page = null;
    let datum = null;

    for (; index < this._model.total(); index += 1) {
      pageIndex = Math.floor(index / count);
      page = this._pages.get(pageIndex);

      if (typeof page === 'undefined') {
        continue;
      }

      datumIndex = index % count;
      datum = page[datumIndex];

      if (this._items.has(datum) === true) {
        return this._items.get(datum);
      }
    }

    return null;
  }

  _group(index) {
    const groups = this._model.groups();

    for (let i = 0; i < groups.length; i += 1) {
      if (index >= groups[i].begin && index < groups[i].end) {
        return i;
      }
    }

    return -1;
  }

  _normalize(scroll) {
    if (this._direction === -1) {
      return this._body.node().scrollWidth -
        this._body.node().offsetWidth - scroll;
    }

    return scroll;
  }

  _range(numbers) {
    return [numbers[0], numbers[numbers.length - 1]];
  }
}
