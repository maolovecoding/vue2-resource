/* @flow */

import { mergeOptions } from '../util/index'

// mixin方法 Vue.mixin
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    // 谁调用 this就是谁 最终会将 mixin选项和Vue.options合并在一起
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
