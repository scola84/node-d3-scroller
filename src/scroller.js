/* eslint prefer-reflect: "off" */

import {
  drag,
  event,
  range,
  scaleLinear,
  select
} from 'd3';

import 'd3-selection-multi';

export default class Scroller {
  constructor() {
    this._domain = null;
    this._modifier = null;

    this._range = null;
    this._step = null;
    this._ticks = false;
    this._keyDelta = 1;

    this._scale = scaleLinear()
      .clamp(true);

    this._root = select('body')
      .append('div')
      .remove()
      .classed('scola scroller', true)
      .styles({
        'height': '3em',
        'padding': '0.5em 0'
      });

    this._area = this._root
      .append('div')
      .classed('scola area', true)
      .styles({
        'align-items': 'center',
        'cursor': 'pointer',
        'display': 'flex',
        'flex': 1,
        'height': '2em',
        'position': 'relative',
      });

    this._line = this._area
      .append('div')
      .classed('scola line', true)
      .styles({
        'background': '#AAA',
        'height': '1px',
        'position': 'absolute',
        'width': '100%'
      });

    this._mark = this._line
      .append('div')
      .classed('scola mark', true)
      .styles({
        'background': '#F00',
        'height': 'inherit',
        'width': 0
      });

    this._tickRoot = this._area
      .append('div')
      .classed('scola ticks', true)
      .styles({
        'height': '50%',
        'position': 'absolute',
        'width': '100%'
      });

    this._knob = this._area
      .append('button')
      .classed('scola knob', true)
      .attrs({
        'tabindex': -1,
        'type': 'button'
      })
      .styles({
        'background': '#FFF',
        'border': 0,
        'border-radius': '1em',
        'box-shadow': '0 1px 5px #AAA',
        'cursor': 'pointer',
        'height': '1.85em',
        'left': '0.925em',
        'margin': 0,
        'margin-left': '-0.925em',
        'opacity': 0,
        'padding': 0,
        'position': 'absolute',
        'width': '1.85em'
      });

    this._padding = this._root
      .append('div')
      .styles({
        'width': '1em'
      });

    this._handleDrag = () => this._drag();
    this._handleInterrupt = () => this._interrupt();
    this._handleKeyUp = () => this._keyUp();
    this._handleKeyDown = () => this._keyDown();
    this._handleWheel = () => this._wheel();

    this._bindArea();
    this._bindKnob();
  }

  destroy() {
    this._unbindArea();
    this._unbindKnob();

    this._root.dispatch('destroy');
    this._root.remove();
    this._root = null;
  }

  root() {
    return this._root;
  }

  domain(value = null, modifier = null) {
    if (value === null) {
      return this._domain;
    }

    this._domain = value;
    this._modifier = modifier;

    this._scale.domain(value);
    return this;
  }

  size(value = null) {
    if (value === null) {
      return this._root.style('width');
    }

    this._root.styles({
      'flex': 'none',
      'width': value
    });

    return this;
  }

  step(value = null) {
    if (value === null) {
      return this._step;
    }

    this._step = value;
    return this;
  }

  tabindex(value = null) {
    if (value === null) {
      return this._knob.attr('tabindex');
    }

    this._knob.attr('tabindex', value);
    return this;
  }

  ticks(value = null) {
    if (value === null) {
      return this._ticks;
    }

    this._ticks = value;
    return this;
  }

  resize() {
    const width = parseFloat(this._area.style('width'));
    const margin = parseFloat(this._knob.style('width')) / 2;

    this._range = [margin, width - margin];
    this._scale.range(this._range);

    this._setup();
    return this;
  }

  value(scrollValue, emit = true) {
    if (!this._domain) {
      return this;
    }

    const scrollPosition = this._scale(scrollValue);

    this._knob.styles({
      'left': scrollPosition + 'px',
      'opacity': 1
    });

    this._mark.styles({
      'width': scrollPosition + 'px'
    });

    if (emit === false) {
      return this;
    }

    this._root.dispatch('scroll', {
      detail: {
        position: scrollPosition,
        value: scrollValue
      }
    });

    return this;
  }

  _bindArea() {
    this._dragger = drag()
      .on('start.interrupt', this._handleInterrupt)
      .on('start drag', this._handleDrag);

    this._area.call(this._dragger);
    this._area.on('wheel.scola-list', this._handleWheel);
  }

  _unbindArea() {
    this._area.on('.drag', null);
    this._area.on('wheel.scola-list', null);
  }

  _bindKnob() {
    this._knob.on('keydown', this._handleKeyDown);
    this._knob.on('keyup', this._handleKeyUp);
  }

  _unbindKnob() {
    this._knob.on('keydown', null);
    this._knob.on('keyup', null);
  }

  _drag() {
    this._set(event.x, 0);
  }

  _interrupt() {
    this._area.interrupt();
  }

  _keyUp() {
    this._keyDelta = 1;
  }

  _keyDown() {
    let delta = 0;
    let left = parseFloat(this._knob.style('left'));
    const width = parseFloat(this._area.style('width'));

    if (event.keyCode === 40) {
      delta += this._keyDelta;
    } else if (event.keyCode === 38) {
      delta -= this._keyDelta;
    } else if (event.keyCode === 36) {
      delta = width;
    } else if (event.keyCode === 35) {
      delta = -width;
    } else {
      return;
    }

    event.preventDefault();

    this._keyDelta = Math.max(this._keyDelta + 1, 20);
    left -= delta;

    this._set(left, delta);
  }

  _wheel() {
    event.preventDefault();

    let left = parseFloat(this._knob.style('left'));
    left -= event.deltaY;

    this._set(left, event.deltaY);
  }

  _set(left, delta) {
    let value = this._scale.invert(left);

    if (this._step) {
      if (delta < 0) {
        value = Math.ceil(value / this._step) * this._step;
      } else if (delta > 0) {
        value = Math.floor(value / this._step) * this._step;
      } else {
        console.log('equal');
        value = Math.round(value / this._step) * this._step;
      }
    }

    if (this._modifier) {
      value = this._modifier(value);
    }

    this.value(value);
  }

  _setup() {
    if (!this._domain || !this._step || this._ticks === false) {
      return;
    }

    const data = range(this._domain[0], this._domain[1], this._step);

    data.push(this._domain[1]);

    const ticks = this._tickRoot
      .selectAll('.tick')
      .data(data);

    ticks.exit().remove();

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
      .style('left', (datum) => {
        return this._scale(datum) + 'px';
      });
  }
}
