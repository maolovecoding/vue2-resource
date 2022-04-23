import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // 核心
  this._init(options)
}

initMixin(Vue) // _init
stateMixin(Vue)// Vue.prototype.$set/$delete/$watch
eventsMixin(Vue) // 发布订阅 $on/$once/$off/$emit
lifecycleMixin(Vue) // _update/$forceUpdate/$destroy
renderMixin(Vue) // _render $nextTick

export default Vue
