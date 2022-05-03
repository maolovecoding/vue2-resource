/* @flow */

import { hasOwn } from 'shared/util'
import { warn, hasSymbol } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'

export function initProvide (vm: Component) {
  // 在当前组件上通过_provide属性 对应的就是提供的对象
  const provide = vm.$options.provide
  if (provide) {
    // provide (a:1) -> vm._provide.a = 1
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}
// 注入
export function initInjections (vm: Component) {
  // inject ["a"] 在自己的父亲里找到对应的属性 递归向上查找
  // 优先找自己的 _provide提供的属性，然后是父组件 父组件的父组件 ...
  const result = resolveInject(vm.$options.inject, vm)
  if (result) {
    toggleObserving(false)
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        // 把属性定义在自己身上
        defineReactive(vm, key, result[key])
      }
    })
    toggleObserving(true)
  }
}

export function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    const result = Object.create(null) // {}
    const keys = hasSymbol
      ? Reflect.ownKeys(inject)
      : Object.keys(inject)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // #6574 in case the inject object is observed...
      if (key === '__ob__') continue
      const provideKey = inject[key].from
      let source = vm // 将当前实例作为开头 向上查找父亲
      while (source) {
        if (source._provided && hasOwn(source._provided, provideKey)) {
          // 找到了结果 保存在 result中
          // 先看自己的 _provide 中是否提供了该属性 有就使用自己的
          result[key] = source._provided[provideKey]
          break
        }
        // 没有就递归向父亲中查找父组件的 _provide属性是否提供
        source = source.$parent
      }
      if (!source) {
        if ('default' in inject[key]) {
          const provideDefault = inject[key].default
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    return result
  }
}
