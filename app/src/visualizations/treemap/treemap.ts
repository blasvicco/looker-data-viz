import { select, Selection } from 'd3-selection'
import { hierarchy, treemap, HierarchyNode } from 'd3-hierarchy'
import { scaleOrdinal, scaleSequential } from 'd3-scale'
import { interpolateRgbBasis } from 'd3-interpolate'
import { extent } from 'd3-array'
import { hsl } from 'd3-color'
import clsx from 'clsx'
import { VisualizationDefinition, VisData, Row, Cell } from 'types/looker'
import { formatType, generateUid } from 'common/util'
import './treemap.css'

interface TreemapVisualization extends VisualizationDefinition {
  frame?: Selection<SVGGElement, unknown, null, undefined>
  focusRing?: Selection<SVGRectElement, unknown, null, undefined>
}

type Datum = Row | Map<string, Datum>

const margin = 1
const defaultPalette = ['#002060', '#0042C7', '#97BAFF', '#7F7F7F']
const defaultGradient = ['#E1E0DF', '#002060']

const weightedMean = <T>(
  collection: Iterable<T>,
  value: (t: T) => number,
  weight: (t: T) => number
) => {
  const denominator = Array.from(collection)
    .map(weight)
    .reduce((a, b) => a + b, 0)
  const numerator = Array.from(collection)
    .map((t) => weight(t) * value(t))
    .reduce((a, b) => a + b, 0)
  return numerator && numerator / denominator
}

const reduceDimensions = (dimensions: Array<{ name: string }>) => (
  datum: Datum,
  row: Row
): Datum => {
  if (dimensions.length === 0) {
    return row
  }
  const map = datum as Map<string, Datum>
  const [dim, ...rest] = dimensions
  const key = row[dim.name].value
  const child =
    (map.get(key) as Map<string, Datum>) || new Map<string, Datum>()
  return map.set(key, reduceDimensions(rest)(child, row))
}

const buildHierarchy = (data: VisData, dimensions: any[]) => {
  return hierarchy(
    [
      'root',
      data.reduce(reduceDimensions(dimensions), new Map<string, Datum>())
    ],
    ([_label, children]: [string, Datum]) => {
      return children instanceof Map ? [...children.entries()] : null
    }
  )
}

const vis: TreemapVisualization = {
  id: 'treemap',
  label: 'Tree Map',
  options: {
    fontSize: {
      type: 'number',
      label: 'Font Size',
      display: 'range',
      min: 8,
      max: 32,
      step: 2,
      default: 14,
      order: 1
    },
    displayMeasure: {
      type: 'boolean',
      label: 'Display measure in Labels',
      display: 'boolean',
      default: false,
      order: 2
    },
    measureFormat: {
      type: 'string',
      label: 'Measure Format',
      display: 'text',
      placeholder: 'Spreadsheet-style format code',
      order: 3
    },
    hideClippedLabels: {
      type: 'boolean',
      label: 'Hide clipped labels',
      display: 'boolean',
      default: false,
      order: 4
    },
    palette: {
      type: 'array',
      label: 'Color Palette',
      display: 'colors',
      default: defaultPalette,
      order: 5
    },
    gradient: {
      type: 'array',
      label: 'Gradient',
      display: 'colors',
      default: defaultGradient,
      order: 6
    },
    gradientMin: {
      type: 'number',
      label: 'Gradient Min. Value',
      display: 'number',
      order: 7,
      display_size: 'half'
    },
    gradientMax: {
      type: 'number',
      label: 'Gradient Max. Value',
      display: 'number',
      order: 8,
      display_size: 'half'
    }
  },
  create: function (element, settings) {
    this.frame = select(element)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .append('g')
      .attr('transform', `translate(${margin}, ${margin})`)
  },
  update: function (data, element, config, queryResponse, details) {
    this.clearErrors!()

    const { clientWidth: width, clientHeight: height } = element

    const {
      fontSize,
      palette,
      gradient,
      gradientMin,
      gradientMax,
      displayMeasure,
      measureFormat,
      hideClippedLabels
    } = config

    const {
      fields: { dimensions, measures, table_calculations },
      pivots = []
    } = queryResponse

    if (dimensions.length === 0) {
      this.addError!({
        title: 'Dimensions Required',
        message: 'Please include at least one dimension.'
      })
      return
    }
    if (!measures[0] && !table_calculations[0]) {
      this.addError!({
        title: 'Primary Measure Required',
        message:
          'Please include at least one un-pivoted measure or table calculation.'
      })
      return
    }

    const isWeighted = table_calculations[1] || pivots[1] || measures[1]

    const getPrimaryCell = (row: Row) => {
      if (table_calculations[0]) {
        return row[table_calculations[0].name]
      } else if (pivots[0]) {
        return row[measures[0].name][pivots[0].key]
      } else if (measures[0]) {
        return row[measures[0].name]
      }
    }

    const getSecondaryCell = (row: Row) => {
      if (table_calculations[1]) {
        return row[table_calculations[1].name]
      } else if (pivots[1]) {
        return row[measures[0].name][pivots[1].key]
      } else if (measures[1]) {
        return row[measures[1].name]
      }
    }

    const formatDimension = (value: string | null) =>
      value === null ? '∅' : value
    const formatPrimaryMeasure = formatType(
      measureFormat || measures[0].value_format
    )

    const activateCell = (event: Event, d: HierarchyNode<[string, Datum]>) => {
      const links = d
        .leaves()
        .map((leaf) => leaf.data[1] as Row)
        .map((row) => getPrimaryCell(row) as Cell)
        .flatMap((cell) => cell.links || [])
        .map((link) => new URL(link.url, window.location.href))

      if (links.length === 0) {
        return
      }

      const url = links.reduce((acc, url) => {
        acc.searchParams.forEach((value, key) => {
          if (url.searchParams.get(key) !== value) {
            acc.searchParams.delete(key)
          }
        })
        return acc
      })
      LookerCharts.Utils.openDrillMenu({
        event,
        links: [
          {
            type: 'drill',
            label: `Show all for ${formatDimension(d.data[0])}`,
            type_label: 'Explore',
            url: url.pathname + url.search
          }
        ]
      })
    }

    const root = buildHierarchy(data, dimensions)
      .sum(([_, datum]) =>
        datum instanceof Map ? 0 : getPrimaryCell(datum).value
      )
      .sort((a, b) => b.value! - a.value!)

    const scaleSecondaryMeasure = scaleSequential(
      interpolateRgbBasis(gradient || defaultGradient)
    )

    if (isWeighted) {
      const domain = extent(data.map((row) => getSecondaryCell(row).value))
      scaleSecondaryMeasure.domain([
        gradientMin == null ? domain[0] : gradientMin,
        gradientMax == null ? domain[1] : gradientMax
      ])
    }

    const color = scaleOrdinal<string>()
      .domain(root.children!.map((d) => d.data[0]))
      .range(palette || defaultPalette)

    const boxFill = (d: HierarchyNode<[string, Datum]>) =>
      isWeighted
        ? scaleSecondaryMeasure(
            weightedMean(
              d.leaves().map((leaf) => leaf.data[1] as Row),
              (row) => getSecondaryCell(row).value,
              (row) => getPrimaryCell(row).value
            )
          )
        : color(d.ancestors().slice(-2, -1)[0].data[0])

    const textFill = (d: HierarchyNode<[string, Datum]>) =>
      hsl(boxFill(d)).l > 0.5 ? '#454545' : '#FFFFFF'

    const layout = treemap<[string, Datum]>()
      .size([width - 2 * margin, height - 2 * margin])
      .paddingTop((d) => d.depth && fontSize * 1.5 * Math.pow(1.4, d.height))
      .round(true)

    const uidIndex = new Map<HierarchyNode<unknown>, number>()

    const nodes = this.frame!.selectAll('.node')
      .data(
        layout(root)
          .descendants()
          .filter((d) => d.depth > 0)
      )
      .join((enter) => {
        const group = enter
          .append('g')
          .attr('class', 'node')
          .attr('data-uid', (d) => {
            const uid = generateUid()
            uidIndex.set(d, uid)
            return uid
          })

        group.append('rect')
          .attr('class', 'box')
          .attr('id', (d) => `box-${uidIndex.get(d)}`)
        group.append('clipPath')
          .attr('id', (d) => `clip-${uidIndex.get(d)}`)
          .append('use')
          .attr('href', (d) => `#box-${uidIndex.get(d)}`)
          .attr('stroke-width', '0.25em')
        group.append('text')
          .attr('class', 'label')
          .attr(
            'clip-path',
            (_d, i, nodes) =>
              `url(#clip-${nodes[i].parentElement!.dataset.uid})`
          )
        return group
      })
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.x0}, ${d.y0})`)

    nodes.selectAll('.box')
      .data((d) => d)
      .attr('width', (d) => d.x1 - d.x0)
      .attr('height', (d) => d.y1 - d.y0)
      .attr('fill', boxFill)

    nodes.selectAll<SVGTextElement, Datum>('text.label')
      .data((d) => d)
      .attr('font-size', (d) => fontSize * Math.pow(1.4, d.height))
      .attr('x', fontSize * 0.5)
      .attr('y', '1.1em')
      .attr('fill', textFill)
      .text(
        (node) =>
          `${formatDimension(node.data[0])} ${
            displayMeasure ? `(${formatPrimaryMeasure(node.value!)}) ` : ''
          }`
      )
      .attr('class', (_, i, nodes) => {
        const element = nodes[i]
        const label = element.getBoundingClientRect()
        const rect = element
          .parentElement?.querySelector('.box')?.getBoundingClientRect()
        const occluded = rect &&
          hideClippedLabels &&
          (label.left < rect.left ||
            label.right > rect.right ||
            label.top < rect.top ||
            label.bottom > rect.bottom)
        return clsx('label', { occluded })
      })

    nodes
      .attr('role', 'button')
      .style('cursor', 'pointer')
      .attr('tabindex', 0)
      .attr('aria-label', (d) => d.data[0])
      .on('focus', (_event, d) => {
        this.focusRing = this.frame!.append('rect')
          .attr('class', 'focus-ring')
          .attr('fill', 'none')
          .attr('x', d.x0)
          .attr('y', d.y0)
          .attr('width', d.x1 - d.x0)
          .attr('height', d.y1 - d.y0)
      })
      .on('blur', () => {
        this.focusRing?.remove()
      })
      .on('click', activateCell)
      .on('keydown', (event: KeyboardEvent, d) => {
        if (event.code === 'Space' || event.code === 'Enter') {
          activateCell(
            Object.assign(event, {
              pageX: d.x0 + (d.x1 - d.x0) / 2,
              pageY: d.y0 + (d.y1 - d.y0) / 2
            }),
            d
          )
        }
      })
  }
}

export default vis
