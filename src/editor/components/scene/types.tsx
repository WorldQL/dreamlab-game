/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ZodEnum, ZodType } from 'zod'
import { z, ZodDefault, ZodObject, ZodOptional } from 'zod'

interface ZodTypeDef {
  typeName: string
}

type HandleArgSave = (key: string, value?: { _v: unknown }) => void

// Types for renderNumberInput, renderStringInput, renderArrayInputs, and renderFallbackInput
type RenderInputFunctionType = (
  key: string,
  value: any | number | string,
  handleArgChange: (
    key: string,
    newValue: any | boolean | number | string,
  ) => void,
  handleArgSave: HandleArgSave,
  argsInputRefs: React.MutableRefObject<{
    [key: string]: HTMLInputElement | null
  }>,
) => JSX.Element

type RenderEnumSelectFunctionType = (
  key: string,
  value: string,
  schema: ZodEnum<any>,
  handleArgChange: (key: string, newValue: string) => void,
  handleArgSave: HandleArgSave,
) => JSX.Element

type RenderBooleanCheckboxFunctionType = (
  key: string,
  value: boolean,
  handleArgChange: (key: string, newValue: boolean) => void,
  handleArgSave: HandleArgSave,
  argsInputRefs: React.MutableRefObject<{
    [key: string]: HTMLInputElement | null
  }>,
) => JSX.Element

type RenderComplexObjectFunctionType = (
  key: string,
  value: any,
  handleArgChange: (key: string, newValue: any) => void,
  handleArgSave: HandleArgSave,
  argsInputRefs: React.MutableRefObject<{
    [key: string]: HTMLInputElement | null
  }>,
) => JSX.Element

type RenderInputForZodSchemaFunctionType = (
  key: string,
  value: any,
  schema: ZodType<any, any>,
  handleArgChange: (key: string, newValue: any) => void,
  handleArgSave: HandleArgSave,
  argsInputRefs: React.MutableRefObject<{
    [key: string]: HTMLInputElement | null
  }>,
  depth: number,
) => JSX.Element

const renderNumberInput: RenderInputFunctionType = (
  key,
  value,
  handleArgChange,
  handleArgSave,
  argsInputRefs,
) => (
  <>
    <p style={{ fontWeight: 'bold', margin: '0' }}>{key}:</p>
    <input
      onBlur={() => handleArgSave(key)}
      onChange={ev => handleArgChange(key, ev.target.valueAsNumber)}
      onKeyDown={ev => {
        if (ev.key === 'Enter') {
          argsInputRefs.current[key]?.blur()
          return
        }

        ev.stopPropagation()
      }}
      ref={el => (argsInputRefs.current[key] = el)}
      type='number'
      value={value as number}
    />
  </>
)

const renderEnumSelect: RenderEnumSelectFunctionType = (
  key,
  value,
  schema,
  handleArgChange,
  handleArgSave,
) => (
  <>
    <p style={{ fontWeight: 'bold', margin: '0' }}>{key}:</p>
    <select
      onBlur={() => handleArgSave(key)}
      onChange={ev => handleArgChange(key, ev.target.value)}
      value={value}
    >
      {schema.options.map((enumValue: unknown) => (
        <option key={String(enumValue)} value={String(enumValue)}>
          {String(enumValue)}
        </option>
      ))}
    </select>
  </>
)

const renderStringInput: RenderInputFunctionType = (
  key,
  value,
  handleArgChange,
  handleArgSave,
  argsInputRefs,
) => (
  <>
    <p style={{ fontWeight: 'bold', margin: '0' }}>{key}:</p>
    <input
      onBlur={() => handleArgSave(key)}
      onChange={ev => handleArgChange(key, ev.target.value)}
      onKeyDown={ev => {
        if (ev.key === 'Enter') {
          argsInputRefs.current[key]?.blur()
          return
        }

        ev.stopPropagation()
      }}
      ref={el => (argsInputRefs.current[key] = el)}
      type='text'
      value={value as string}
    />
  </>
)

const renderArrayInputs: RenderInputFunctionType = (
  key,
  value,
  handleArgChange,
  handleArgSave,
  argsInputRefs,
) => {
  if (!Array.isArray(value)) {
    return <p>{key}: Invalid array</p>
  }

  return (
    <>
      <p style={{ fontWeight: 'bold', margin: '0' }}>{key}:</p>
      {value.map((item, index) => {
        const itemKey = `${key}[${index}]`
        return (
          <div key={itemKey} style={{ marginBottom: '8px' }}>
            <input
              onBlur={() => handleArgSave(key)}
              onChange={ev => handleArgChange(itemKey, ev.target.value)}
              onKeyDown={ev => {
                if (ev.key === 'Enter') {
                  argsInputRefs.current[itemKey]?.blur()
                  return
                }

                ev.stopPropagation()
              }}
              ref={el => (argsInputRefs.current[itemKey] = el)}
              type='text'
              value={item}
            />
          </div>
        )
      })}
    </>
  )
}

const renderBooleanCheckbox: RenderBooleanCheckboxFunctionType = (
  key,
  value,
  handleArgChange,
  handleArgSave,
  argsInputRefs,
) => (
  <>
    <p style={{ fontWeight: 'bold', margin: '0' }}>{key}:</p>
    <input
      checked={value}
      onBlur={() => handleArgSave(key)}
      onChange={ev => {
        handleArgChange(key, ev.target.checked)
        handleArgSave(key, { _v: ev.target.checked })
      }}
      ref={el => (argsInputRefs.current[key] = el)}
      type='checkbox'
    />
  </>
)

const renderFallbackInput: RenderInputFunctionType = (
  key,
  value,
  handleArgChange,
  handleArgSave,
  argsInputRefs,
) => {
  if (typeof value === 'number') {
    return renderNumberInput(
      key,
      value,
      handleArgChange,
      handleArgSave,
      argsInputRefs,
    )
  }

  return renderStringInput(
    key,
    value,
    handleArgChange,
    handleArgSave,
    argsInputRefs,
  )
}

const renderComplexObject: RenderComplexObjectFunctionType = (
  key,
  value,
  handleArgChange,
  handleArgSave,
  argsInputRefs,
) => {
  if (typeof value === 'object' && value !== null) {
    return (
      <>
        {Object.entries(value).map(([subKey, subValue]) => {
          const fullKey = `${key}.${subKey}`
          switch (typeof subValue) {
            case 'number':
              return (
                <div key={fullKey}>
                  {renderNumberInput(
                    fullKey,
                    subValue,
                    handleArgChange,
                    handleArgSave,
                    argsInputRefs,
                  )}
                </div>
              )
            case 'boolean':
              return (
                <div key={fullKey}>
                  {renderBooleanCheckbox(
                    fullKey,
                    subValue,
                    handleArgChange,
                    handleArgSave,
                    argsInputRefs,
                  )}
                </div>
              )
            case 'string':
              return (
                <div key={fullKey}>
                  {renderStringInput(
                    fullKey,
                    subValue,
                    handleArgChange,
                    handleArgSave,
                    argsInputRefs,
                  )}
                </div>
              )
            case 'object':
              return (
                <div key={fullKey}>
                  {renderComplexObject(
                    fullKey,
                    subValue,
                    handleArgChange,
                    handleArgSave,
                    argsInputRefs,
                  )}
                </div>
              )
            default:
              return (
                <div key={fullKey}>
                  {renderFallbackInput(
                    fullKey,
                    subValue,
                    handleArgChange,
                    handleArgSave,
                    argsInputRefs,
                  )}
                </div>
              )
          }
        })}
      </>
    )
  }

  return <span>Invalid object value</span>
}

export const renderInputForZodSchema: RenderInputForZodSchemaFunctionType = (
  key,
  value,
  schema,
  handleArgChange,
  handleArgSave,
  argsInputRefs,
  depth = 0,
) => {
  if (!schema) {
    console.error(`Invalid schema provided for key: ${key}`)
    return null
  }

  if (depth > 10) {
    console.error(`Maximum depth exceeded for key: ${key}`)
    return null
  }

  const unwrappedSchema =
    schema instanceof ZodDefault || schema instanceof ZodOptional
      ? schema._def.innerType
      : schema instanceof z.ZodEffects || schema instanceof z.ZodTransformer
        ? schema._def.schema
        : schema

  const zodTypeDef = (unwrappedSchema as any)._def as ZodTypeDef

  if (unwrappedSchema instanceof z.ZodDiscriminatedUnion) {
    const discriminatorKey = unwrappedSchema._def.discriminator
    const discriminatorValue = value[discriminatorKey]
    const selectedSchema = unwrappedSchema.options[discriminatorValue]

    if (selectedSchema) {
      return renderInputForZodSchema(
        key,
        value,
        selectedSchema,
        handleArgChange,
        handleArgSave,
        argsInputRefs,
        depth + 1,
      )
    }
  }

  switch (zodTypeDef.typeName) {
    case 'ZodNumber':
      return renderNumberInput(
        key,
        value,
        handleArgChange,
        handleArgSave,
        argsInputRefs,
      )
    case 'ZodEnum':
      return renderEnumSelect(
        key,
        value,
        unwrappedSchema,
        handleArgChange,
        handleArgSave,
      )
    case 'ZodUnion':
      return unwrappedSchema.options.map((unionType: unknown) =>
        renderInputForZodSchema(
          key,
          value,
          unionType as ZodType<any, any, any>,
          handleArgChange,
          handleArgSave,
          argsInputRefs,
          depth + 1,
        ),
      )
    case 'ZodObject': {
      const objectSchema =
        schema instanceof ZodObject
          ? schema
          : schema instanceof ZodDefault || schema instanceof ZodOptional
            ? schema._def.innerType
            : null

      if (!objectSchema?.shape) {
        console.error(
          `Invalid or undefined object schema detected for key: ${key}`,
        )
        return <p>Invalid Schema</p>
      }

      return (
        <div key={key} style={{ marginBottom: '16px' }}>
          {Object.keys(objectSchema.shape).map(propertyKey => {
            const propertySchema = objectSchema.shape[propertyKey]
            const propertyValue =
              typeof value === 'object' && value
                ? value[propertyKey]
                : undefined
            return (
              <div key={`${key}.${propertyKey}`}>
                {renderInputForZodSchema(
                  `${key}.${propertyKey}`,
                  propertyValue,
                  propertySchema,
                  handleArgChange,
                  handleArgSave,
                  argsInputRefs,
                  depth + 1,
                )}
              </div>
            )
          })}
        </div>
      )
    }

    case 'ZodString':
      return renderStringInput(
        key,
        value,
        handleArgChange,
        handleArgSave,
        argsInputRefs,
      )
    case 'ZodArray':
      return renderArrayInputs(
        key,
        value,
        handleArgChange,
        handleArgSave,
        argsInputRefs,
      )
    case 'ZodBoolean':
      return renderBooleanCheckbox(
        key,
        value,
        handleArgChange,
        handleArgSave,
        argsInputRefs,
      )
    default:
      if (typeof value === 'object' && value !== null) {
        return renderComplexObject(
          key,
          value,
          handleArgChange,
          handleArgSave,
          argsInputRefs,
        )
      }

      return renderInputForZodSchema(
        key,
        value,
        schema._def.innerType,
        handleArgChange,
        handleArgSave,
        argsInputRefs,
        depth + 1,
      )
  }
}
