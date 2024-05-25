/*********************/
/****** Private ******/
/*********************/
// type declaration
type VisConfigValue = any

// Interface declaration
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

interface LookerChartsType {
  Utils: LookerChartsUtils
}

interface LookerChartsUtils {
  openDrillMenu(options: DrillOptions)
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

interface Looker {
  plugins: {
    visualizations: {
      add: (visualization: VisDefinition) => void;
    };
  }
}

/*********************/
/****** Public *******/
/*********************/
// type declaration
export type VisData = Row[]

// Interface declaration
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
  id?: string
  label?: string
  options: VisOptions
  addError?: (error: VisError) => void
  clearErrors?: (errorName?: string) => void
  create: (element: HTMLElement, settings: VisConfig) => void
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
  destroy?: () => void
}

export interface VisQueryResponse {
  [key: string]: any
  data: VisData
  fields: {
    [key: string]: any[];
  }
  pivots: Pivot[]
}

// Global declaration
declare global {
  const looker: Looker
  const LookerCharts: LookerChartsType
}
