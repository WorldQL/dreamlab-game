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
) => {
  const keys = key.split('.')
  const title = keys[keys.length - 1]
  return (
    <div className='detail-col'>
      <span>{title}:</span>
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
    </div>
  )
}

const renderEnumSelect: RenderEnumSelectFunctionType = (
  key,
  value,
  schema,
  handleArgChange,
  handleArgSave,
) => {
  const keys = key.split('.')
  const title = keys[keys.length - 1]
  return (
    <div className='detail-col' style={{ marginBottom: '10px' }}>
      <span
        style={{
          fontWeight: '600',
          marginRight: '10px',
          whiteSpace: 'nowrap',
          marginBottom: '4px',
        }}
      >
        {title}:
      </span>
      <select
        onBlur={() => handleArgSave(key)}
        onChange={ev => handleArgChange(key, ev.target.value)}
        style={{
          width: '100%',
          padding: '2px',
          borderRadius: '4px',
          border: '1px solid #ccc',
          backgroundColor: 'white',
          cursor: 'pointer',
          boxSizing: 'border-box',
          height: '30px',
        }}
        value={value}
      >
        {schema.options.map((enumValue: unknown) => (
          <option key={String(enumValue)} value={String(enumValue)}>
            {String(enumValue)}
          </option>
        ))}
      </select>
    </div>
  )
}

const renderStringInput: RenderInputFunctionType = (
  key,
  value,
  handleArgChange,
  handleArgSave,
  argsInputRefs,
) => {
  const keys = key.split('.')
  const title = keys[keys.length - 1]
  return (
    <div className='detail-col'>
      <span>{title}:</span>
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
    </div>
  )
}

const renderBooleanCheckbox: RenderBooleanCheckboxFunctionType = (
  key,
  value,
  handleArgChange,
  handleArgSave,
  argsInputRefs,
) => {
  const keys = key.split('.')
  const title = keys[keys.length - 1]
  return (
    <div className='detail-col'>
      <span>{title}:</span>
      <input
        checked={value}
        onBlur={() => handleArgSave(key)}
        onChange={ev => {
          handleArgChange(key, ev.target.checked)
          handleArgSave(key, { _v: ev.target.checked })
        }}
        ref={el => (argsInputRefs.current[key] = el)}
        style={{
          height: '1rem',
          width: '1rem',
          borderRadius: '0.25rem',
        }}
        type='checkbox'
      />
    </div>
  )
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

  if (zodTypeDef.typeName === 'ZodDiscriminatedUnion') {
    const discriminatorKey = unwrappedSchema._def.discriminator
    const discriminatorValue = value[discriminatorKey]
    const optionsMap = unwrappedSchema._def.optionsMap
    const selectedSchema = optionsMap.get(discriminatorValue)

    if (selectedSchema) {
      const keys = [...optionsMap.keys()]

      const nested = renderInputForZodSchema(
        key,
        value,
        selectedSchema.omit({ [discriminatorKey]: true }),
        handleArgChange,
        handleArgSave,
        argsInputRefs,
        depth + 1,
      )

      const select = renderEnumSelect(
        `${key}.${discriminatorKey}`,
        discriminatorValue,
        // @ts-expect-error we dont need readonly enum
        z.enum(keys),
        handleArgChange,
        handleArgSave,
      )

      return (
        <>
          {select}
          {nested}
        </>
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
        handleArgSave(key, { _v: newArray })
      }

      return (
        <div className='detail-col' key={key} style={{ marginBottom: '10px' }}>
          <span>{key}:</span>
          {Array.isArray(value) &&
            value.map((item, index) => (
              <div
                key={`${key}[${item}]`}
                style={{
                  paddingLeft: '20px',
                  paddingTop: '5px',
                  borderLeft: '2px solid #ddd',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '5px',
                  }}
                >
                  <span style={{ marginRight: '10px' }}>{`Item ${
                    index + 1
                  }`}</span>
                  <button
                    onClick={() => handleRemoveItem(index)}
                    style={{
                      marginRight: '4px',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      backgroundColor: '#f9f9f9',
                    }}
                    type='button'
                  >
                    <svg
                      style={{ width: '16px', height: '16px', fill: 'red' }}
                      viewBox='0 0 24 24'
                      xmlns='http://www.w3.org/2000/svg'
                    >
                      <path
                        clipRule='evenodd'
                        d='M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058 a.75.75 0 10-1.498-.058l-.347 9 a.75.75 0 001.5.058l.345-9z'
                        fillRule='evenodd'
                      />
                    </svg>
                  </button>
                </div>
                {renderInputForZodSchema(
                  `${key}[${index}]`,
                  item,
                  arraySchema.element,
                  handleArgChange,
                  handleArgSave,
                  argsInputRefs,
                  depth + 1,
                )}
              </div>
            ))}
          <button
            onClick={handleAddItem}
            style={{ marginTop: '5px' }}
            type='button'
          >
            Add Item
          </button>
        </div>
      )
    }

    case 'ZodRecord': {
      const recordSchema = unwrappedSchema as z.ZodRecord<z.ZodTypeAny>

      if (!value || typeof value !== 'object') {
        console.error(
          `Invalid or undefined record value detected for key: ${key}`,
        )
        return <p>Invalid Value</p>
      }

      const entries = Object.entries(value)

      return (
        <div className='detail-col' key={key} style={{ marginBottom: '16px' }}>
          <span>{key}:</span>
          {entries.map(([recordKey, recordValue]) => (
            <div
              key={`${key}.${recordKey}`}
              style={{
                paddingLeft: '20px',
                paddingTop: '5px',
                borderLeft: '2px solid #ddd',
              }}
            >
              {renderInputForZodSchema(
                `${key}.${recordKey}`,
                recordValue,
                recordSchema.element,
                handleArgChange,
                handleArgSave,
                argsInputRefs,
                depth + 1,
              )}
            </div>
          ))}
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

      const keys = key.split('.')
      const title = keys[keys.length - 1]

      return (
        <div className='detail-col' key={key} style={{ marginBottom: '16px' }}>
          <span>{title}:</span>
          {Object.keys(objectSchema.shape).map(propertyKey => {
            const propertySchema = objectSchema.shape[propertyKey]
            const propertyValue =
              typeof value === 'object' && value
                ? value[propertyKey]
                : undefined
            return (
              <div
                key={`${key}.${propertyKey}`}
                style={{
                  paddingLeft: '20px',
                  paddingTop: '5px',
                  borderLeft: '2px solid #ddd',
                }}
              >
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
