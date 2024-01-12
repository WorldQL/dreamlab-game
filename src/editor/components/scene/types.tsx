/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ZodEnum, ZodType } from 'zod'
import { z, ZodDefault, ZodObject, ZodOptional } from 'zod'

interface ZodTypeDef {
  typeName: string
}

type HandleArgSave = (key: string, value?: { _v: unknown }) => void

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
    const optionsMap = unwrappedSchema._def.optionsMap
    const selectedSchema = optionsMap.get(discriminatorValue)

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
    case 'ZodLiteral':
    case 'ZodString':
      return renderStringInput(
        key,
        value,
        handleArgChange,
        handleArgSave,
        argsInputRefs,
      )
    case 'ZodArray': {
      const arraySchema = unwrappedSchema as z.ZodArray<z.ZodTypeAny>

      const handleAddItem = () => {
        const keys = Object.keys(arraySchema.element._def.shape)
        const newItem = { keys }

        const newArray = [...value, newItem]
        handleArgChange(key, newArray)
        handleArgSave(key, { _v: newArray })
      }

      const handleRemoveItem = (index: number) => {
        const newArray = [...value]
        newArray.splice(index, 1)
        handleArgChange(key, newArray)
      }

      return (
        <div key={key}>
          {Array.isArray(value)
            ? value.map((item, index) => (
                <div key={`${key}[${item}]`}>
                  {renderInputForZodSchema(
                    `${key}[${index}]`,
                    item,
                    arraySchema.element,
                    handleArgChange,
                    handleArgSave,
                    argsInputRefs,
                    depth + 1,
                  )}
                  <button onClick={() => handleRemoveItem(index)} type='button'>
                    Remove
                  </button>
                </div>
              ))
            : null}
          <button onClick={handleAddItem} type='button'>
            Add Item
          </button>
        </div>
      )
    }

    case 'ZodBoolean':
      return renderBooleanCheckbox(
        key,
        value,
        handleArgChange,
        handleArgSave,
        argsInputRefs,
      )
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
    case 'ZodTuple':
      return null
    // Don't think we need to render this. But if so, use code below.
    // <>
    //   {unwrappedSchema.items.map(
    //     (itemSchema: ZodType<any, any, any>, index: number | string) => {
    //       const itemKey = `${key}[${index}]`
    //       const itemValue = Array.isArray(value)
    //         ? value[index as any]
    //         : undefined
    //       return (
    //         <div key={itemKey}>
    //           {renderInputForZodSchema(
    //             itemKey,
    //             itemValue,
    //             itemSchema,
    //             handleArgChange,
    //             handleArgSave,
    //             argsInputRefs,
    //             depth + 1,
    //           )}
    //         </div>
    //       )
    //     },
    //   )}
    // </>

    case 'ZodObject': {
      const objectSchema =
        schema instanceof ZodObject
          ? schema
          : schema instanceof ZodDefault || schema instanceof ZodOptional
            ? schema._def.innerType
            : schema

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

    default: {
      const newSchema = unwrappedSchema._def.innerType
        ? unwrappedSchema._def.innerType
        : unwrappedSchema._def.schema
          ? unwrappedSchema._def.schema
          : unwrappedSchema._def.shape

      return renderInputForZodSchema(
        key,
        value,
        newSchema,
        handleArgChange,
        handleArgSave,
        argsInputRefs,
        depth + 1,
      )
    }
  }
}
