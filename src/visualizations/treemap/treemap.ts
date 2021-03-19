import { select, Selection } from "d3-selection";
import { hierarchy, treemap } from "d3-hierarchy";
import { scaleOrdinal } from "d3-scale";
import { VisualizationDefinition, VisData, Row } from "types/looker";
import { validateResponse } from "common/util";
import "./treemap.css";

interface TreemapVisualization extends VisualizationDefinition {
  frame?: Selection<SVGGElement, unknown, null, undefined>;
}

type Datum = Row | Map<string, Datum>;

const reduceDimensions = (dimensions: Array<{ name: string }>) => (
  datum: Datum,
  row: Row
): Datum => {
  if (dimensions.length === 0) {
    return row;
  }
  const map = datum as Map<string, Datum>;
  const [dim, ...rest] = dimensions;
  const key = row[dim.name].value;
  const child =
    (map.get(key) as Map<string, Datum>) || new Map<string, Datum>();
  return map.set(key, reduceDimensions(rest)(child, row));
};

const buildHierarchy = (data: VisData, dimensions: any[]) => {
  return hierarchy(
    [
      "root",
      data.reduce(reduceDimensions(dimensions), new Map<string, Datum>()),
    ],
    ([_label, children]: [string, Datum]) => {
      return children instanceof Map ? [...children.entries()] : null;
    }
  );
};

const margin = 1;
const vis: TreemapVisualization = {
  id: "treemap",
  label: "Tree Map",
  options: {
    fontSize: {
      type: "number",
      label: "Font Size",
      display: "range",
      min: 8,
      max: 32,
      step: 2,
      default: 14,
    },
    palette: {
      type: "array",
      label: "Color Palette",
      display: "colors",
      default: ["#002060", "#0042C7", "#97BAFF", "#7F7F7F"],
    },
  },
  create: function (element) {
    this.frame = select(element)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .append("g")
      .attr("transform", `translate(${margin}, ${margin})`);
  },
  update: function (data, element, config, queryResponse) {
    validateResponse(this, queryResponse, {
      min_dimensions: 1,
      min_measures: 1,
      max_measures: 1,
    });
    const { clientWidth: width, clientHeight: height } = element;

    const { fontSize, palette } = config;

    const {
      dimension_like: dimensions,
      measure_like: [measure],
    } = queryResponse.fields;

    const root = buildHierarchy(data, dimensions)
      .sum(([_, datum]) =>
        datum instanceof Map ? 0 : datum[measure.name].value
      )
      .sort((a, b) => b.value! - a.value!);

    const color = scaleOrdinal<string>()
      .domain(root.children!.map((d) => d.data[0]))
      .range(palette);

    const layout = treemap<[string, Datum]>()
      .size([width - 2 * margin, height - 2 * margin])
      .paddingTop((d) => d.depth && fontSize * 1.5 * Math.pow(1.4, d.height))
      .round(true);

    const nodes = this.frame!.selectAll(".node")
      .data(
        layout(root)
          .descendants()
          .filter((d) => d.depth > 0)
      )
      .join((enter) => {
        const group = enter.append("g").attr("class", "node");
        group.append("rect").attr("class", "box");
        group.append("text").attr("class", "label");
        return group;
      })
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x0}, ${d.y0})`);

    const boxes = nodes
      .selectAll(".box")
      .data((d) => d)
      .attr("width", (d) => d.x1 - d.x0)
      .attr("height", (d) => d.y1 - d.y0)
      .attr("fill", (d) => color(d.ancestors().slice(-2, -1)[0].data[0]));

    const labels = nodes
      .selectAll(".label")
      .data((d) => d)
      .attr("font-size", (d) => fontSize * Math.pow(1.4, d.height))
      .attr("x", fontSize * 0.5)
      .attr("y", "1.1em")
      .text((node) => `${node.data[0]} (${node.value})`);
  },
};

export default vis;
