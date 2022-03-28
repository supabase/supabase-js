import 'jest-circus-allure-environment'
import { JestAllureInterface } from 'jest-circus-allure-environment'
import { ContentType } from 'allure-js-commons'

// eslint-disable-next-line @typescript-eslint/ban-types
type TestDecorator = (
  target: object,
  property: string,
  descriptor: PropertyDescriptor
) => PropertyDescriptor

function getAllure(): JestAllureInterface {
  // @ts-ignore
  if (!global.allure) {
    throw new Error('Unable to find Allure implementation')
  }
  // @ts-ignore
  return global.allure
}

export function step<T>(nameFn: string | ((arg: T) => string)): TestDecorator {
  return (target: object, propertyKey: string, descriptor: PropertyDescriptor) => {
    const original: object = descriptor.value
    let callable: (args: T) => void = () => {
      /* */
    }

    if (typeof original === 'function') {
      descriptor.value = function (...args: [T]) {
        try {
          const value: string = typeof nameFn === 'function' ? nameFn.apply(this, args) : nameFn
          callable = () => getAllure().step(value, () => original.apply(this, args))
          // tslint:disable-next-line:no-console
          console.info(`Step: ${value || nameFn}`)
        } catch (e) {
          // tslint:disable-next-line:no-console
          console.error(`[ERROR] Failed to apply decorator: ${e}`)
        }
        return callable.apply(this, args)
      }
    }
    return descriptor
  }
}

export const addStep = getAllure().step

export function attachment<T>(name: string, type: ContentType) {
  return (
    _target: object,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    const original: object = descriptor.value
    let callable: (args: T) => void = () => {
      /* */
    }

    if (typeof original === 'function') {
      descriptor.value = async function (...args: [T]) {
        try {
          const content: Buffer | string = await original.apply(this, args)
          callable = () =>
            getAllure().step(name, () => {
              getAllure().attachment(type.toString(), content, type)
            })
        } catch (e) {
          // tslint:disable-next-line:no-console
          console.error(`[ERROR] Failed to apply decorator: ${e}`)
        }
        return callable.apply(this, args)
      }
    }
    return descriptor
  }
}

export function attach(name: string, content: string | Buffer, type: ContentType): void {
  getAllure().step(name, () => {
    getAllure().attachment(type.toString(), content, type)
  })
}

export function log(name: string, description?: string): void {
  console.info(description ? `${name}: ${description}` : name)
  getAllure().step(name, () => {
    if (description) {
      getAllure().step(description, () => {
        /* */
      })
    }
  })
}
