/*********************/
/****** Private ******/
/*********************/
// type declaration
type VisConfigValue = any

// interface declaration
interface DrillOptions {
  links: Link[]
  event: Event
}

interface Link {
  label: string
  type: string
  type_label: string
  url: string
}

interface Looker {
  plugins: {
    visualizations: {
      add: (visualization: VisDefinition) => void;
    };
  }
}

interface LookerChartsType {
  Utils: LookerChartsUtils
}

interface LookerChartsUtils {
  openDrillMenu(options: DrillOptions): any
}

interface Pivot {
  key: string
  is_total: boolean
  data: { [key: string]: string }
  metadata: { [key: string]: { [key: string]: string } }
}

interface PivotCell {
  [pivotKey: string]: Cell
}

interface VisConfig {
  [key: string]: VisConfigValue
}

interface VisError {
  group?: string
  message?: string
  title?: string
  retryable?: boolean
  warning?: boolean
}

interface VisOption {
  type: string
  values?: VisOptionValue[]
  display?: string
  default?: any
  label: string
  section?: string
  placeholder?: string
  display_size?: 'half' | 'third' | 'normal'
  order?: number
  min?: number
  max?: number
  step?: number
  required?: boolean
}

interface VisOptions {
  [optionName: string]: VisOption
}

interface VisOptionValue {
  [label: string]: string
}

interface VisUpdateDetails {
  changed: {
    config?: string[];
    data?: boolean;
    queryResponse?: boolean;
    size?: boolean;
  }
}

/*********************/
/****** Public *******/
/*********************/
// type declaration
export type VisData = Row[]

// interface declaration
export interface Cell {
  [key: string]: any
  value: any
  rendered?: string
  html?: string
  links?: Link[]
}

export interface Row {
  [fieldName: string]: PivotCell | Cell
}

export interface VisDefinition {
  // attributes
  id?: string
  label?: string
  options: VisOptions
  // methods
  create: (element: HTMLElement, settings: VisConfig) => void
  // optional methods
  addError?: (error: VisError) => void
  clearErrors?: (errorName?: string) => void
  destroy?: () => void
  trigger?: (event: string, config: object[]) => void
  update?: (
    data: VisData,
    element: HTMLElement,
    config: VisConfig,
    queryResponse: VisQueryResponse,
    details?: VisUpdateDetails
  ) => void
  updateAsync?: (
    data: VisData,
    element: HTMLElement,
    config: VisConfig,
    queryResponse: VisQueryResponse,
    details: VisUpdateDetails | undefined,
    updateComplete: () => void
  ) => void
}

export interface VisQueryResponse {
  [key: string]: any
  data: VisData
  fields: {
    [key: string]: any[];
  }
  pivots: Pivot[]
}

// global declaration
declare global {
  const looker: Looker
  const LookerCharts: LookerChartsType
}
