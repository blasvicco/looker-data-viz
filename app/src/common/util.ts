// Lib imports
import { format } from 'd3-format'

// App imports
import { VisDefinition, VisQueryResponse } from 'types/looker'

/*********************/
/****** Private ******/
/*********************/
// type declaration
type GroupError = {
  group: string;
  message: string;
  title: string;
}

// interface declaration
interface TGroup {
  count: number
  max?: number
  min?: number
  name: string
  noun: string
}

// class declaration
class CGroup implements TGroup {
  count: number
  max?: number
  min?: number
  name: string
  noun: string

  constructor(group: TGroup) {
    this.count = group.count
    this.max = group.max
    this.min = group.min
    this.name = group.name
    this.noun = group.noun

    this.pluralize = this.pluralize.bind(this)
    this.validate = this.validate.bind(this)
  }

  pluralize = (): string => {
    return `${this.noun.toLowerCase()}${this.min === 1 ? '' : 's'}`
  }

  validate = (): GroupError => {
    const msg = {
      min: {
        required: 'at least',
        title: 'Not Enough',
        value: this.min
      },
      max: {
        required: 'no more than',
        title: 'Too many',
        value: this.max
      }
    }
    const response: GroupError = {
      group: this.name,
      message: '',
      title: ''
    }
    const eType: string = (this.min && this.count < this.min)
      ? 'min'
      : (this.max && this.count > this.max)
        ? 'max'
        : ''
    if (eType) {
      const field = eType as keyof typeof msg
      const required = (this.min !== this.max && msg[field].required) || 'exactly'
      response.message = `This visualization requires ${required} ${msg[field].value} ${this.pluralize()}.`
      response.title = `${msg[field].title} ${this.noun}s`
    }
    return response
  }
}

// static variable
let uid = 0

/*********************/
/****** Public *******/
/*********************/
// Interface declaration
export interface ValidationOptions {
  min_pivots?: number
  max_pivots?: number
  min_dimensions?: number
  max_dimensions?: number
  min_measures?: number
  max_measures?: number
}

// Method declaration
export const validateResponse = (
  vis: VisDefinition,
  res: VisQueryResponse,
  options: ValidationOptions
) => {
  const check = (OGroup: CGroup): boolean => {
    if (!vis.addError || !vis.clearErrors) return false
    const error = OGroup.validate()
    if (error.title) {
      vis.addError({ ...error })
      return false
    }
    vis.clearErrors(OGroup.name)
    return true
  }

  const { pivots, dimensions, measure_like: measures } = res.fields

  return (
    check(new CGroup({
      name: 'pivot-req',
      noun: 'Pivot',
      count: pivots.length,
      max: options.max_pivots,
      min: options.min_pivots
    })) &&
    check(new CGroup({
      name: 'dim-req',
      noun: 'Dimension',
      count: dimensions.length,
      max: options.max_dimensions,
      min: options.min_dimensions
    })) &&
    check(new CGroup({
      name: 'mes-req',
      noun: 'Measure',
      count: measures.length,
      max: options.max_measures,
      min: options.min_measures
    }))
  )
}

export const formatType = (valueFormat: string) => {
  if (!valueFormat) return format('')
  let specifier = (valueFormat.charAt(0) in ['$', '£', '€'])
    ? valueFormat.charAt(0)
    : ''
  if (valueFormat.indexOf(',') > -1) {
    specifier += ','
  }
  const splitValueFormat = valueFormat.split('.')
  specifier += '.'
  specifier += splitValueFormat.length > 1 ? splitValueFormat[1].length : 0
  const translator = {
    '%': '%',
    '0': 'f',
    's': 's'
  }
  const key = valueFormat.slice(-1) as keyof typeof translator
  specifier += translator[key] || ''
  return format(specifier)
}

export const generateUid = () => ++uid
