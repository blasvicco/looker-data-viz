import { VisualizationDefinition, VisQueryResponse } from "types/looker";

export interface ValidationOptions {
  min_pivots?: number;
  max_pivots?: number;
  min_dimensions?: number;
  max_dimensions?: number;
  min_measures?: number;
  max_measures?: number;
}

export const validateResponse = (
  vis: VisualizationDefinition,
  res: VisQueryResponse,
  options: ValidationOptions
) => {
  const check = (
    group: string,
    noun: string,
    count: number,
    min?: number,
    max?: number
  ): boolean => {
    if (!vis.addError || !vis.clearErrors) return false;
    if (min && count < min) {
      vis.addError({
        title: `Not Enough ${noun}s`,
        message: `This visualization requires ${
          min === max ? "exactly" : "at least"
        } ${min} ${noun.toLowerCase()}${min === 1 ? "" : "s"}.`,
        group,
      });
      return false;
    }
    if (max && count > max) {
      vis.addError({
        title: `Too Many ${noun}s`,
        message: `This visualization requires ${
          min === max ? "exactly" : "no more than"
        } ${max} ${noun.toLowerCase()}${min === 1 ? "" : "s"}.`,
        group,
      });
      return false;
    }
    vis.clearErrors(group);
    return true;
  };

  const { pivots, dimensions, measure_like: measures } = res.fields;

  return (
    check(
      "pivot-req",
      "Pivot",
      pivots.length,
      options.min_pivots,
      options.max_pivots
    ) &&
    check(
      "dim-req",
      "Dimension",
      dimensions.length,
      options.min_dimensions,
      options.max_dimensions
    ) &&
    check(
      "mes-req",
      "Measure",
      measures.length,
      options.min_measures,
      options.max_measures
    )
  );
};
