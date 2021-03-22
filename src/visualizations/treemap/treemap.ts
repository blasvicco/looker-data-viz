import { select, Selection } from "d3-selection";
import { hierarchy, treemap } from "d3-hierarchy";
import { scaleOrdinal, scaleSequential } from "d3-scale";
import { interpolateRgbBasis } from "d3-interpolate";
import { extent } from "d3-array";
import clsx from "clsx";
import { VisualizationDefinition, VisData, Row } from "types/looker";
import { formatType, validateResponse } from "common/util";
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
    gradient: {
      type: "array",
      label: "Gradient",
      display: "colors",
      default: ["#002060", "#fdea45"],
    },
    displayMeasure: {
      type: "boolean",
      label: "Display Measure in Labels",
      display: "boolean",
      default: true,
    },
  },
  create: function (element, settings) {
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
      max_measures: 2,
    });
    const { clientWidth: width, clientHeight: height } = element;

    const { fontSize, palette, gradient, displayMeasure } = config;

    const {
      dimension_like: dimensions,
      measure_like: [primaryMeasure, secondaryMeasure],
    } = queryResponse.fields;

    const formatDimension = (value: string | null) =>
      value === null ? "∅" : value;
    const formatPrimaryMeasure = formatType(primaryMeasure.value_format);

    const root = buildHierarchy(data, dimensions)
      .sum(([_, datum]) =>
        datum instanceof Map ? 0 : datum[primaryMeasure.name].value
      )
      .sort((a, b) => b.value! - a.value!);

    const scaleSecondaryMeasure = scaleSequential(
      interpolateRgbBasis(gradient || [])
    );

    if (secondaryMeasure) {
      const domain = extent(
        data.map((row) => row[secondaryMeasure.name].value)
      );
      scaleSecondaryMeasure.domain(domain as [number, number]);
    }

    const color = scaleOrdinal<string>()
      .domain(root.children!.map((d) => d.data[0]))
      .range(palette || []);

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
      .attr("fill", (d) =>
        secondaryMeasure && d.height === 0
          ? scaleSecondaryMeasure(
              (d.data[1] as Row)[secondaryMeasure.name].value
            )
          : color(d.ancestors().slice(-2, -1)[0].data[0])
      );

    const labels = nodes
      .selectAll<SVGTextElement, Datum>("text.label")
      .data((d) => d)
      .attr("font-size", (d) => fontSize * Math.pow(1.4, d.height))
      .attr("x", fontSize * 0.5)
      .attr("y", "1.1em")
      .text(
        (node) =>
          `${formatDimension(node.data[0])} ${
            displayMeasure ? `(${formatPrimaryMeasure(node.value!)}) ` : ""
          }`
      )
      .attr("class", (_, i, nodes) => {
        const element = nodes[i];
        const label = element.getBoundingClientRect();
        const rect = element
          .parentElement!.querySelector(".box")!
          .getBoundingClientRect();
        const occluded =
          label.left < rect.left ||
          label.right > rect.right ||
          label.top < rect.top ||
          label.bottom > rect.bottom;
        return clsx("label", { occluded });
      });
  },
};

export default vis;
