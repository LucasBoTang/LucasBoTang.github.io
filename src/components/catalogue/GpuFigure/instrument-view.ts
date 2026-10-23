import {
  convergenceChannels,
  formatConvergenceReadings,
  type ConvergenceFrame,
  type ConvergenceModel,
} from './convergence-model.ts';

function requireElement<ElementType extends Element>(
  root: ParentNode,
  selector: string,
): ElementType {
  const element = root.querySelector<ElementType>(selector);
  if (!element) throw new Error(`GPU instrument is missing ${selector}.`);
  return element;
}

/** Own SVG geometry and digit presentation; the model owns recorded values and playback time. */
export function createInstrumentView(root: HTMLElement, model: ConvergenceModel) {
  const palette = getComputedStyle(root);
  const colors = convergenceChannels.map((channel) =>
    palette.getPropertyValue(`--gpu-${channel}`).trim(),
  );
  const svg = requireElement<SVGSVGElement>(root, '[data-scope]');
  const iteration = requireElement<HTMLOutputElement>(root, '[data-iteration]');
  const time = requireElement<HTMLOutputElement>(root, '[data-time]');
  const restarts = requireElement<HTMLOutputElement>(root, '[data-restarts]');
  const readings = convergenceChannels.map((channel) =>
    requireElement<HTMLOutputElement>(root, `[data-reading="${channel}"]`),
  );
  const outputs = [iteration, time, restarts, ...readings];
  let previousRecordIndex = -1;
  let readingsComplete = false;
  let wasReducedMotion = false;
  const svgNamespace = 'http://www.w3.org/2000/svg';
  let width = 400,
    height = 190;
  const left = 26,
    right = 5,
    top = 20,
    bottom = 6;
  let clip: SVGRectElement;
  let dots: SVGCircleElement[] = [];
  const projectIteration = (iteration: number) =>
    left + ((width - left - right) * iteration) / model.final.iteration;
  const projectResidual = (value: number) =>
    top +
    ((height - top - bottom) *
      (model.logCeiling - Math.log10(Math.max(value, 10 ** model.logFloor)))) /
      (model.logCeiling - model.logFloor);
  function svgElement<Tag extends keyof SVGElementTagNameMap>(
    name: Tag,
    attributes: Record<string, string | number>,
    text?: string,
  ): SVGElementTagNameMap[Tag] {
    const element = document.createElementNS(svgNamespace, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function resize() {
    width = svg.clientWidth;
    height = svg.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.replaceChildren();
    const defs = svgElement('defs', {}),
      clipPath = svgElement('clipPath', { id: 'instrument-trace-window' });
    clip = svgElement('rect', {
      x: left - 1,
      y: 0,
      width: width - left + 1,
      height,
    });
    clipPath.append(clip);
    defs.append(clipPath);
    svg.append(defs);
    const axisY = height - bottom;
    svg.append(
      svgElement('path', {
        d: `M${left} ${top - 2}V${axisY}H${width - right}`,
        fill: 'none',
        stroke: '#475362',
        'stroke-width': 0.6,
      }),
    );
    svg.append(
      svgElement(
        'text',
        { x: left, y: 8, fill: '#8997a7', 'font-size': width < 200 ? 8 : 9 },
        'Relative KKT',
      ),
    );
    const exponents = width < 240 ? [-1, -4, -9] : [-1, -4, -7, -10];
    for (const exponent of exponents) {
      const tickY = projectResidual(10 ** exponent);
      svg.append(
        svgElement('line', {
          x1: left - 3,
          y1: tickY,
          x2: left,
          y2: tickY,
          stroke: '#627084',
          'stroke-width': 0.7,
        }),
      );
      const label = svgElement(
        'text',
        {
          x: left - 6,
          y: tickY + 2.5,
          fill: '#8795a6',
          'font-size': 8,
          'text-anchor': 'end',
        },
        '10',
      );
      label.append(
        svgElement('tspan', { 'baseline-shift': 'super', 'font-size': 6 }, String(exponent)),
      );
      svg.append(label);
    }
    const traces = svgElement('g', { 'clip-path': 'url(#instrument-trace-window)' });
    for (const point of model.points.filter((point) => point.restart)) {
      traces.append(
        svgElement('line', {
          'data-restart-marker': point.iteration,
          x1: projectIteration(point.iteration),
          x2: projectIteration(point.iteration),
          y1: top,
          y2: axisY,
          stroke: '#8191a5',
          'stroke-width': 0.65,
          opacity: 0.2,
        }),
      );
    }
    convergenceChannels.forEach((channel, index) => {
      const pathData = model.points
        .map(
          (point, index) =>
            `${index ? 'L' : 'M'}${projectIteration(point.iteration).toFixed(2)} ${projectResidual(point[channel]).toFixed(2)}`,
        )
        .join(' ');
      // A fine ink-colored edge preserves legibility over the photograph.
      traces.append(
        svgElement('path', {
          d: pathData,
          fill: 'none',
          stroke: '#101113',
          'stroke-width': 3.5,
          opacity: 0.65,
        }),
      );
      traces.append(
        svgElement('path', {
          d: pathData,
          fill: 'none',
          stroke: colors[index],
          'stroke-width': 1.25,
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round',
        }),
      );
    });
    svg.append(traces);
    dots = convergenceChannels.map((_, index) =>
      svgElement('circle', {
        r: 1.8,
        fill: colors[index],
        stroke: '#101113',
        'stroke-width': 0.8,
      }),
    );
    svg.append(...dots);
  }
  function updateDigits(output: HTMLOutputElement, value: string, reducedMotion: boolean) {
    if (output.dataset.value === value) return;
    const previousValue = output.dataset.value || '';
    output.dataset.value = value;
    output.replaceChildren(
      ...Array.from(value, (character, index) => {
        const digit = document.createElement('span');
        digit.className = 'digit';
        digit.textContent = character;
        if (
          !reducedMotion &&
          previousValue &&
          previousValue[index] !== character &&
          /[0-9]/.test(character)
        ) {
          digit.animate(
            [
              { transform: 'translateY(-3px)', opacity: 0.35 },
              { transform: 'translateY(0)', opacity: 1 },
            ],
            { duration: 170, easing: 'cubic-bezier(.2,.7,.3,1)' },
          );
        }
        return digit;
      }),
    );
  }
  function render(frame: ConvergenceFrame, reducedMotion: boolean, opacity = 1) {
    // Fade the plot and its values together; labels retain their fixed positions.
    const visibility = String(opacity);
    if (svg.style.opacity !== visibility) {
      svg.style.opacity = visibility;
      for (const output of outputs) output.style.opacity = visibility;
    }
    // Settle active digits even when the final recorded values no longer change.
    if (reducedMotion && !wasReducedMotion) {
      for (const output of outputs) {
        output.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
      }
    }
    wasReducedMotion = reducedMotion;
    const cursorX = projectIteration(frame.iteration);
    clip?.setAttribute('width', String(Math.max(0, cursorX - left + 1)));
    convergenceChannels.forEach((channel, index) => {
      dots[index]?.setAttribute('cx', String(cursorX));
      dots[index]?.setAttribute(
        'cy',
        String(
          projectResidual(frame.previous[channel]) +
            (projectResidual(frame.next[channel]) - projectResidual(frame.previous[channel])) *
              frame.fraction,
        ),
      );
      dots[index]?.setAttribute('opacity', frame.started ? '1' : '0');
    });
    if (frame.recordIndex !== previousRecordIndex || (frame.complete && !readingsComplete)) {
      const formatted = formatConvergenceReadings(frame, model.timeScale);
      updateDigits(iteration, formatted.iteration, reducedMotion);
      updateDigits(time, formatted.time, reducedMotion);
      updateDigits(restarts, formatted.restarts, reducedMotion);
      convergenceChannels.forEach((channel, index) =>
        updateDigits(readings[index], formatted.channels[channel], reducedMotion),
      );
      root.dataset.restarting = String(formatted.restarting);
      previousRecordIndex = frame.recordIndex;
      readingsComplete = frame.complete;
    }
  }
  resize();
  return { svg, resize, render };
}
