// Lib imports
import clsx from 'clsx'
import { extent } from 'd3-array'
import { hsl } from 'd3-color'
import { hierarchy, treemap, HierarchyNode } from 'd3-hierarchy'
import { interpolateRgbBasis } from 'd3-interpolate'
import { scaleOrdinal, scaleSequential } from 'd3-scale'
import { select, Selection } from 'd3-selection'

// App imports
import { formatType, generateUid } from 'common/util'
import { VisDefinition, VisData, VisQueryResponse, Row, Cell } from 'types/looker'
import './treemap.css'

/*********************/
/****** Private ******/
/*********************/
// type declaration
type Datum = Row | Map<string, Datum>

// interface declaration
interface TreemapVisualization extends VisDefinition {
  frame?: Selection<SVGGElement, unknown, null, undefined>
  focusRing?: Selection<SVGRectElement, unknown, null, undefined>
  __hasError: (queryResponse: VisQueryResponse) => boolean
}

// constant declaration
const DEFAULT_GRADIENT = ['#E1E0DF', '#002060']
const DEFAULT_PALETTE = ['#002060', '#0042C7', '#97BAFF', '#7F7F7F']
const MARGIN = 1

// methods declaration
const buildHierarchy = (data: VisData, dimensions: any[]) => {
  const flatten = (dimensions: Array<{ name: string }>) => (
    datum: Datum,
    row: Row
  ): Datum => {
    if (dimensions.length === 0) {
      return row
    }
    const map = datum as Map<string, Datum>
    const [dim, ...rest] = dimensions
    const key = row[dim.name].value
    const child = (map.get(key) as Map<string, Datum>)
      || new Map<string, Datum>()
    return map.set(key, flatten(rest)(child, row))
  }

  return hierarchy(
    [
      'root',
      data.reduce(flatten(dimensions), new Map<string, Datum>())
    ],
    ([_label, children]: [string, Datum]) => {
      return children instanceof Map ? [...children.entries()] : null
    }
  )
}

const getCell = (
  queryResponse: VisQueryResponse,
  position: number,
  row: Row
) => {
  const {
    fields: { measures, table_calculations },
    pivots = []
  } = queryResponse
  if (table_calculations[position]) {
    return row[table_calculations[position].name]
  } else if (pivots[position]) {
    return row[measures[0].name][pivots[position].key]
  } else if (measures[position]) {
    return row[measures[position].name]
  }
}

const weightedMean = <T>(
  collection: Iterable<T>,
  value: (t: T) => number,
  weight: (t: T) => number
) => {
  const denominator = Array.from(collection)
    .reduce((sum, item) => sum + weight(item), 0)
  const numerator = Array.from(collection)
    .reduce((sum, item) => sum + weight(item) * value(item), 0)
  return numerator && numerator / denominator
}

// defining visualization object
const vis: TreemapVisualization = {
  // object attributes
  id: 'treemap',
  label: 'Tree Map',
  options: {
    displayMeasure: {
      default: false,
      display: 'boolean',
      label: 'Display measure in Labels',
      order: 2,
      type: 'boolean'
    },
    fontSize: {
      default: 14,
      display: 'range',
      label: 'Font Size',
      max: 32,
      min: 8,
      order: 1,
      step: 2,
      type: 'number'
    },
    gradient: {
      default: DEFAULT_GRADIENT,
      display: 'colors',
      label: 'Gradient',
      order: 6,
      type: 'array'
    },
    gradientMax: {
      display: 'number',
      display_size: 'half',
      label: 'Gradient Max. Value',
      order: 8,
      type: 'number'
    },
    gradientMin: {
      display: 'number',
      display_size: 'half',
      label: 'Gradient Min. Value',
      order: 7,
      type: 'number'
    },
    hideClippedLabels: {
      default: false,
      display: 'boolean',
      label: 'Hide clipped labels',
      order: 4,
      type: 'boolean'
    },
    measureFormat: {
      display: 'text',
      label: 'Measure Format',
      order: 3,
      placeholder: 'Spreadsheet-style format code',
      type: 'string'
    },
    palette: {
      default: DEFAULT_PALETTE,
      display: 'colors',
      label: 'Color Palette',
      order: 5,
      type: 'array'
    }
  },
  // object methods
  __hasError(queryResponse: VisQueryResponse) {
    const {
      fields: { dimensions, measures, table_calculations },
      pivots = []
    } = queryResponse
    const error = { message: '', title: '' }

    this.clearErrors!()
    if (dimensions.length === 0) {
      error.title = 'Dimensions Required'
      error.message= 'Please include at least one dimension.'
    } else if (!measures[0] && !table_calculations[0]) {
      error.title = 'Primary Measure Required'
      error.message = 'Please include at least one un-pivoted measure or table calculation.'
    }
    if (error.title) {
      this.addError!(error)
      return true
    }
    return false
  },
  create(element, settings) {
    this.frame = select(element)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .append('g')
      .attr('transform', `translate(${MARGIN}, ${MARGIN})`)
  },
  update(data, element, config, queryResponse, details) {
    // const declaration
    const { clientWidth: width, clientHeight: height } = element
    const {
      displayMeasure,
      fontSize,
      hideClippedLabels,
      gradient,
      gradientMax,
      gradientMin,
      measureFormat,
      palette
    } = config
    const {
      fields: { dimensions, measures, table_calculations },
      pivots = []
    } = queryResponse

    // call error check and exit if any
    if (this.__hasError(queryResponse)) return

    const isWeighted = Boolean(table_calculations[1] || pivots[1] || measures[1])
    const scaleSecondaryMeasure = scaleSequential(
      interpolateRgbBasis(gradient || DEFAULT_GRADIENT)
    )
    if (isWeighted) {
      const domain = extent(data.map((row) => getCell(queryResponse, 1, row).value))
      scaleSecondaryMeasure.domain([
        gradientMin == null ? domain[0] : gradientMin,
        gradientMax == null ? domain[1] : gradientMax
      ])
    }

    const layout = treemap<[string, Datum]>()
      .size([width - 2 * MARGIN, height - 2 * MARGIN])
      .paddingTop((dNode) => dNode.depth && fontSize * 1.5 * Math.pow(1.4, dNode.height))
      .round(true)
    const root = buildHierarchy(data, dimensions)
      .sum(([_, datum]) => datum instanceof Map
          ? 0
          : getCell(queryResponse, 0, datum).value
      )
      .sort((a, b) => b.value! - a.value!)
    const uidIndex = new Map<HierarchyNode<unknown>, number>()
    const nodes = this.frame!.selectAll('.node')
      .data(
        layout(root)
          .descendants()
          .filter((dNode) => dNode.depth > 0)
      )
      .join((enter) => {
        const group = enter
          .append('g')
          .attr('class', 'node')
          .attr('data-uid', (dNode) => {
            const uid = generateUid()
            uidIndex.set(dNode, uid)
            return uid
          })

        group.append('rect')
          .attr('class', 'box')
          .attr('id', (dNode) => `box-${uidIndex.get(dNode)}`)
        group.append('clipPath')
          .attr('id', (dNode) => `clip-${uidIndex.get(dNode)}`)
          .append('use')
          .attr('href', (dNode) => `#box-${uidIndex.get(dNode)}`)
          .attr('stroke-width', '0.25em')
        group.append('text')
          .attr('class', 'label')
          .attr(
            'clip-path',
            (_d, i, nodes) => `url(#clip-${nodes[i].parentElement!.dataset.uid})`
          )
        return group
      })
      .attr('class', 'node')
      .attr('transform', (dNode) => `translate(${dNode.x0}, ${dNode.y0})`)

    const color = scaleOrdinal<string>()
      .domain(root.children!.map((dNode) => dNode.data[0]))
      .range(palette || DEFAULT_PALETTE)
    const boxFill = (dNode: HierarchyNode<[string, Datum]>) => isWeighted
      ? scaleSecondaryMeasure(
          weightedMean(
            dNode.leaves().map((leaf) => leaf.data[1] as Row),
            (row) => getCell(queryResponse, 1, row).value,
            (row) => getCell(queryResponse, 0, row).value
          )
        )
      : color(dNode.ancestors().slice(-2, -1)[0].data[0])
    nodes.selectAll('.box')
      .data((dNode) => dNode)
      .attr('width', (dNode) => dNode.x1 - dNode.x0)
      .attr('height', (dNode) => dNode.y1 - dNode.y0)
      .attr('fill', boxFill)

    const textFill = (dNode: HierarchyNode<[string, Datum]>) => hsl(boxFill(dNode)).l > 0.5
      ? '#454545'
      : '#FFFFFF'
    const fDimension = (value: string | null) => value === null ? '∅' : value
    const fPrimaryMeasure = displayMeasure
      ? formatType(
        measureFormat || measures[0].value_format
      )
      : (_: any) => ''
    nodes.selectAll<SVGTextElement, Datum>('text.label')
      .data((dNode) => dNode)
      .attr('font-size', (dNode) => fontSize * Math.pow(1.4, dNode.height))
      .attr('x', fontSize * 0.5)
      .attr('y', '1.1em')
      .attr('fill', textFill)
      .text(
        (node) => `${fDimension(node.data[0])} ${fPrimaryMeasure(node.value!)}`
      )
      .attr('class', (_, i, nodes) => {
        const element = nodes[i]
        const label = element.getBoundingClientRect()
        const rect = element.parentElement!.querySelector('.box')?.getBoundingClientRect()
        const occluded = rect &&
          hideClippedLabels &&
          (label.left < rect.left ||
            label.right > rect.right ||
            label.top < rect.top ||
            label.bottom > rect.bottom)
        return clsx('label', { occluded })
      })

    const activateCell = (event: Event, dNode: HierarchyNode<[string, Datum]>) => {
      const links = dNode
        .leaves()
        .map((leaf) => leaf.data[1] as Row)
        .map((row) => getCell(queryResponse, 0, row) as Cell)
        .flatMap((cell) => cell.links || [])
        .map((link) => new URL(link.url, window.location.href))

      // if no links then exit
      if (links.length === 0) return

      // TODO: Ask Jeff or Jacob about this code
      // acc it is not initialized so acc.searchParams should be empty
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
        links: [{
          label: `Show all for ${fDimension(dNode.data[0])}`,
          type: 'drill',
          type_label: 'Explore',
          url: `${url.pathname}${url.search}`
        }]
      })
    }
    nodes
      .attr('role', 'button')
      .style('cursor', 'pointer')
      .attr('tabindex', 0)
      .attr('aria-label', (dNode) => dNode.data[0])
      .on('focus', (_event, dNode) => {
        this.focusRing = this.frame!.append('rect')
          .attr('class', 'focus-ring')
          .attr('fill', 'none')
          .attr('x', dNode.x0)
          .attr('y', dNode.y0)
          .attr('width', dNode.x1 - dNode.x0)
          .attr('height', dNode.y1 - dNode.y0)
      })
      .on('blur', () => {
        this.focusRing?.remove()
      })
      .on('click', activateCell)
      .on('keydown', (event: KeyboardEvent, dNode) => {
        if (event.code === 'Space' || event.code === 'Enter') {
          activateCell(
            Object.assign(event, {
              pageX: dNode.x0 + (dNode.x1 - dNode.x0) / 2,
              pageY: dNode.y0 + (dNode.y1 - dNode.y0) / 2
            }),
            dNode
          )
        }
      })
  }
}

/*********************/
/****** Public *******/
/*********************/
// export default
export default vis
