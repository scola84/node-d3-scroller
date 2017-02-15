/* eslint prefer-reflect: "off" */

import {
  drag,
  event,
  range,
  scaleLinear,
  select
} from 'd3';

import debounce from 'lodash-es/debounce';

export default class Scroller {
  constructor() {
    this._name = null;
    this._model = null;
    this._domain = null;

    this._orientation = null;
    this._positionProperty = null;
    this._sizeProperty = null;

    this._range = null;
    this._step = null;
    this._ticks = false;

    this._keyDelta = 1;
    this._debounce = null;

    this._scale = scaleLinear()
      .clamp(true);

    this._root = select('body')
      .append('div')
      .remove()
      .classed('scola scroller', true)
      .styles({
        'cursor': 'pointer',
        'display': 'flex',
        'position': 'relative',
      });

    this._line = this._root
      .append('div')
      .classed('scola line', true)
      .styles({
        'background': '#AAA',
        'position': 'absolute'
      });

    this._mark = this._line
      .append('div')
      .classed('scola mark', true)
      .styles({
        'background': '#007AFF'
      });

    this._tickRoot = this._root
      .append('div')
      .classed('scola ticks', true)
      .styles({
        'position': 'absolute'
      });

    this._knob = this._root
      .append('button')
      .classed('scola knob', true)
      .attrs({
        'tabindex': -1,
        'type': 'button'
      })
      .styles({
        'background': '#FFF',
        'border': 0,
        'border-radius': '50%',
        'box-shadow': '0 1px 5px #AAA',
        'cursor': 'pointer',
        'margin': 0,
        'opacity': 0,
        'padding': 0,
        'position': 'absolute'
      });

    this._handleSet = (e) => this._set(e);

    this._bindRoot();
    this._bindKnob();

    this.debounce();
  }

  destroy() {
    this._unbindRoot();
    this._unbindKnob();
    this._unbindModel();
    this._deleteDebounce();

    this._root.dispatch('destroy');
    this._root.remove();
    this._root = null;
  }

  root() {
    return this._root;
  }

  name(value) {
    if (value === null) {
      return this._name;
    }

    this._name = value;
    return this;
  }

  model(value) {
    this._model = value;

    this._bindModel();
    this._set({
      name: this._name,
      scope: 'model',
      value: value.get(this._name)
    });

    return this;
  }

  domain(value = null) {
    if (value === null) {
      return this._domain;
    }

    this._domain = value;
    this._scale.domain(value);

    return this;
  }

  step(value = null) {
    if (value === null) {
      return this._step;
    }

    this._step = value;
    return this;
  }

  ticks(value = null) {
    if (value === null) {
      return this._ticks;
    }

    this._ticks = value;
    return this;
  }

  tabindex(value = null) {
    if (value === null) {
      return this._knob.attr('tabindex');
    }

    this._knob.attr('tabindex', value);
    return this;
  }

  debounce(delay = 100) {
    if (delay === false) {
      return this._deleteDebounce();
    }

    if (this._debounced) {
      this._deleteDebounce();
    }

    return this._insertDebounce(delay);
  }

  line(action = true) {
    this._line
      .style('display', action ? 'initial' : 'none');

    return this;
  }

  horizontal(height = '2em') {
    this._orientation = 'x';
    this._positionProperty = 'left';
    this._sizeProperty = 'width';

    this._root.styles({
      'align-items': 'center',
      height,
      'justify-content': 'initial',
      'width': '100%'
    });

    this._line.styles({
      'height': '1px',
      'width': '100%'
    });

    this._mark.styles({
      'height': '100%',
      'width': 'initial'
    });

    this._tickRoot.styles({
      'height': '50%',
      'width': '100%'
    });

    return this;
  }

  vertical(width = '2em') {
    this._orientation = 'y';
    this._positionProperty = 'top';
    this._sizeProperty = 'height';

    this._root.styles({
      'align-items': 'initial',
      'height': '100%',
      'justify-content': 'center',
      width
    });

    this._line.styles({
      'height': '100%',
      'width': '1px'
    });

    this._mark.styles({
      'height': 'initial',
      'width': '100%'
    });

    this._tickRoot.styles({
      'height': '100%',
      'width': '50%'
    });

    return this;
  }

  resize() {
    this._resizeKnob();
    this._resizeTicks();

    this._set({
      name: this._name,
      value: this._model.get(this._name)
    });

    return this;
  }

  down() {
    if (!this._step) {
      return;
    }

    const value = this._model.get(this._name) - this._step;

    if (value < this._domain[0] || value > this._domain[1]) {
      return;
    }

    this._model.set(this._name, value);
  }

  up() {
    if (!this._step) {
      return;
    }

    const value = this._model.get(this._name) + this._step;

    if (value < this._domain[0] || value > this._domain[1]) {
      return;
    }

    this._model.set(this._name, value);
  }

  _bindRoot() {
    this._gesture = this._root
      .gesture()
      .on('panstart', (e) => e.stopPropagation())
      .on('panright', (e) => e.stopPropagation())
      .on('panleft', (e) => e.stopPropagation())
      .on('panend', (e) => e.stopPropagation())
      .on('swiperight', (e) => e.stopPropagation())
      .on('swipeleft', (e) => e.stopPropagation());

    this._dragger = drag()
      .container(this._root.node())
      .on('start', () => this._start())
      .on('drag', () => this._drag())
      .on('end', () => this._end());

    this._root.call(this._dragger);
    this._root.on('wheel.scola-list', () => this._wheel());
  }

  _unbindRoot() {
    if (this._gesture) {
      this._gesture.destroy();
      this._gesture = null;
    }

    this._root.on('.drag', null);
    this._root.on('wheel.scola-list', null);
  }

  _bindKnob() {
    this._knob.on('keydown', () => this._keyDown());
    this._knob.on('keyup', () => this._keyUp());
  }

  _unbindKnob() {
    this._knob.on('keydown', null);
    this._knob.on('keyup', null);
  }

  _bindModel() {
    if (this._model) {
      this._model.setMaxListeners(this._model.getMaxListeners() + 1);
      this._model.addListener('set', this._handleSet);
    }
  }

  _unbindModel() {
    if (this._model) {
      this._model.setMaxListeners(this._model.getMaxListeners() - 1);
      this._model.removeListener('set', this._handleSet);
    }
  }

  _start() {
    this._root.dispatch('start');
    this._drag();
  }

  _drag() {
    const position = event[this._orientation];
    this._change(position, 0);
  }

  _end() {
    this._root.dispatch('end');
  }

  _keyUp() {
    this._keyDelta = 1;
  }

  _keyDown() {
    let delta = 0;
    let arrow = false;

    const position = parseFloat(this._knob.style(this._positionProperty));

    [delta, arrow] = this._deltaArrow(event.keyCode);

    if (delta === 0) {
      return;
    }

    event.preventDefault();

    if (arrow === true) {
      delta = this._delta(delta);

      if (delta === 0) {
        return;
      }
    }

    this._keyDelta = Math.max(this._keyDelta + 1, 20);
    this._change(position - delta, delta);
  }

  _deltaArrow(keyCode) {
    let delta = 0;
    let arrow = false;

    const size = parseFloat(this._root.style(this._sizeProperty));

    if (keyCode === 40) {
      delta = this._keyDelta;
      arrow = true;
    } else if (keyCode === 38) {
      delta = -this._keyDelta;
      arrow = true;
    } else if (keyCode === 36) {
      delta = size;
    } else if (keyCode === 35) {
      delta = -size;
    } else {
      delta = 0;
    }

    return [delta, arrow];
  }

  _delta(delta) {
    delta *= this._orientation === 'x' ? 1 : -1;

    if (this._step) {
      if (delta < 0) {
        this.up();
      } else {
        this.down();
      }

      return 0;
    }

    return delta;
  }

  _wheel() {
    event.preventDefault();

    const delta = this._orientation === 'x' ?
      event.deltaY : -event.deltaY;

    const position = parseFloat(this._knob.style(this._positionProperty)) -
      delta;

    this._change(position, delta);
  }

  _change(position, delta) {
    let value = this._scale.invert(position);

    if (this._step) {
      value /= this._step;

      if (delta < 0) {
        value = Math.ceil(value);
      } else if (delta > 0) {
        value = Math.floor(value);
      } else {
        value = Math.round(value);
      }

      value *= this._step;
    }

    if (this._debounced) {
      this._debounced(() => this._model.set(this._name, value));
    }

    this._set({
      name: this._name,
      value
    });
  }

  _set(setEvent) {
    if (setEvent.name !== this._name || !this._domain) {
      return;
    }

    const position = this._scale(setEvent.value);

    this._knob.style(this._positionProperty, position + 'px');
    this._knob.style('opacity', 1);
    this._mark.style(this._sizeProperty, position + 'px');
  }

  _resizeKnob() {
    const height = parseFloat(this._root.style('height'));
    const width = parseFloat(this._root.style('width'));

    let areaSize = width;
    let knobSize = height;

    let margin = knobSize / 2;
    let marginLeft = margin;
    let marginTop = 0;

    if (this._orientation === 'y') {
      areaSize = height;
      knobSize = width;

      margin = knobSize / 2;
      marginLeft = 0;
      marginTop = margin;
    }

    this._range = [margin, areaSize - margin];
    this._scale.range(this._range);

    this._knob.styles({
      'width': knobSize + 'px',
      'height': knobSize + 'px',
      'margin-left': -marginLeft + 'px',
      'margin-top': -marginTop + 'px'
    });
  }

  _resizeTicks() {
    if (!this._domain || !this._step || this._ticks === false) {
      return;
    }

    const data = range(this._domain[0], this._domain[1], this._step);

    data.push(this._domain[1]);

    const ticks = this._tickRoot
      .selectAll('.tick')
      .data(data);

    ticks
      .exit()
      .remove();

    ticks
      .enter()
      .append('div')
      .merge(ticks)
      .classed('scola tick', true)
      .styles({
        'background': '#AAA',
        'height': '100%',
        'position': 'absolute',
        'width': '1px'
      })
      .style(this._positionProperty, (datum) => {
        return this._scale(datum) + 'px';
      });
  }

  _insertDebounce(delay) {
    this._debounced = debounce((f) => f(), delay);
    return this;
  }

  _deleteDebounce() {
    if (this._debounced) {
      this._debounced.cancel();
      this._debounced = null;
    }

    return this;
  }
}
