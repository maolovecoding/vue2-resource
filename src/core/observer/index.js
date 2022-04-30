/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value
    // 对象本身也有dep -> 一个dep
    // 引用类型 -> dep 基本类型 -> dep
    this.dep = new Dep()
    this.vmCount = 0
    // 当前的 observer放在 __ob__属性上
    def(value, '__ob__', this)
    // 数组
    if (Array.isArray(value)) {
      // 有原型 '__proto__' in {}
      if (hasProto) {
        // arrayMethods 重写方法
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      // 数组元素是对象 也可以再次观测 [{}, []]
      this.observeArray(value)
    } else {
      // 对象
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      // 把对象的的每个 key 都变成响应式的
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  // 观测的值不是对象 或者 值是一个虚拟dom（vue规定的，不过也没人写虚拟dom吧）
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  // 有 __ob__ 则该属性已经观测 一个对象对应一个observer
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    // 直接返回观测的数据对应的 observe
    ob = value.__ob__
  } else if (
    // shouldObserve 是否需要被观测
    shouldObserve &&
    // 不是服务端渲染
    !isServerRendering() &&
    // 是数组 或者 对象  对象可扩展属性 值是不vue实例
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    // 一个引用类型 -> new Observer(value)
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 定义响应式 属性 -> dep
  const dep = new Dep()
  const property = Object.getOwnPropertyDescriptor(obj, key)
  // 获取对象的属性描述符 是否可配置
  // 可能直接调用了该方法 Object.getOwnPropertyDescriptor({}, "name") -> undefined
  if (property && property.configurable === false) {
    return
  }
  // cater for pre-defined getter/setters
  // {_name:"nnn", get name(){...}, set name(val){...}}
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    // 有或者没有 getter   有 setter
    val = obj[key]
  }
  //   shallow浅层观测（劫持数据） 递归观测
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      // debugger
      // console.log("get---------",obj,key)
      // 执行getter绑定obj
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        // 使用该值的时候 收集依赖 watcher收集dep
        dep.depend()
        // 新增的数据如果被劫持 childOb = new Observer
        if (childOb) {
          // 引用类型本身也进行依赖收集
          childOb.dep.depend()
          // 数组 递归收集依赖
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      // 获取老的值
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      // old == newVal 值没有更新
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      // 只能访问 不能设置
      if (getter && !setter) return
      if (setter) {
        // 更新值 可能是用户设置的setter 那么就用用户的
        setter.call(obj, newVal)
      } else {
        // 没有setter 就直接更新值
        val = newVal
      }
      // 更新的值可能是引用类型 再次观测
      childOb = !shallow && observe(newVal)
      // 提醒 watcher更新
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
// vm.$set()
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 给数组的指定索引位置元素更改
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    // 巧妙的把修改值 转为删除值后在新增值
    // vm.$set(vm.movies, 1, "ada") -> vm.splice(1, 1, "aaa")
    target.splice(key, 1, val)
    return val
  }
  // 不是新增属性 修改已有的属性直接修改即可，因为是响应式了
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  // 取出对象上的observer对象
  const ob = (target: any).__ob__
  // 如果修改的是vue实例 不支持这样做 性能也比较差
  // vm.$set(vm.$data, "abc", "acbc")  vm.$set(vm, "abc", "acbc")
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  // 不是响应式对象就直接添加
  if (!ob) {
    target[key] = val
    return val
  }
  // 定义响应式
  defineReactive(ob.value, key, val)
  // 更新watcher
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
