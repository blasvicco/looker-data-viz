import { select, Selection } from "d3-selection";
import { VisualizationDefinition } from "types/looker"
import "./treemap.css";

interface CustomVisualization extends VisualizationDefinition {
  title?: Selection<HTMLHeadingElement, unknown, null, undefined>
}

const vis: CustomVisualization = {
  id: "treemap",
  label: "Tree Map",
  options: {
    title: {
      type: 'string',
      label: 'Title',
      display: 'text',
      default: '<Title>'
    }
  },
  create: function(element, settings) {
    this.title = select(element).append('h1');
    select(element).append('h1')
  },
  update: function(data, element, config, queryResponse, details) {
    this.title?.text(config.title);
  }
};


export default vis;