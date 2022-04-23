/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  // 配置信息等
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  // vue的工具方法 extend
  Vue.util = {
    warn,
    extend, // 合并两个对象
    mergeOptions,// 合并策略
    defineReactive // 定义响应式
  }

  Vue.set = set // set
  Vue.delete = del // delete
  Vue.nextTick = nextTick // 实现过

  // 2.6 explicit observable API
  // 把一个对象变成响应式的
  Vue.observable = <T>(obj: T): T => {
    observe(obj)
    return obj
  }
  /* 一个纯空对象 */
  Vue.options = Object.create(null)
  //  Vue.options.components filter
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.

  // 指向构造函数
  Vue.options._base = Vue

  // 全局组件 绑定一些内部实现的组件 keep-alive
  extend(Vue.options.components, builtInComponents)
  // use方法 实现插件
  initUse(Vue)
  // Vue.mixin Vue.extend
  initMixin(Vue)
  initExtend(Vue)
  // Vue.component directive filter
  initAssetRegisters(Vue)
}
