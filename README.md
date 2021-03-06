# vue-study

## vue2的常见源码实现

### rollup环境搭建

#### 安装rollup及其插件

```shell
npm i rollup rollup-plugin-babel @babel/core @babel/preset-env rollup-plugin-node-resolve -D
```

#### 编写配置文件 rollup.config.js

这个可以直接使用es module

```js
// rollup默认可以导出一个对象 作为打包的配置文件
import babel from "rollup-plugin-babel";
import resolve from 'rollup-plugin-node-resolve'
export default {
  // 入口
  input: "./src/index.js",
  // 出口
  output: {
    // 生成的文件
    file: "./dist/vue.js",
    // 全局对象 Vue 在global(浏览器端就是window)上挂载一个属性 Vue
    name: "Vue",
    // 打包方式 esm commonjs模块 iife自执行函数 umd 统一模块规范 -> 兼容cmd和amd
    format: "umd",
    // 打包后和源代码做关联
    sourcemap: true,
  },
  plugins: [
    babel({
      // 排除第三方模块
      exclude: "node_modules/**",
    }),
    // 自动找文件夹下的index文件
    resolve()
  ],
};


```

##### babel.config.js

```js
// babel config
module.exports =  {
  // 预设
  presets: ["@babel/preset-env"],
};

```

#### 编写脚本

```json
"scripts": {
    "dev": "rollup -cw"
  }
```

-c表示使用配置文件，-w表示监控文件变化。

#### element.outerHTML

`outerHTML`属性获取描述元素（包括其后代）的序列化HTML片段。它也可以设置为用从给定字符串解析的节点替换元素。

```html
  <div id="app">
    <h2>{{name}}</h2>
    <span>{{age}}</span>
  </div>
  <script>
    console.log(document.querySelector("#app").outerHTML)
    /*
    <div id="app">
      <h2>{{name}}</h2>
      <span>{{age}}</span>
    </div>
  */
  </script>
```

## 核心流程

  **vue的核心流程：**

    1. 创造响应式数据
    2. 模板编译 生成 ast
    3. ast 转为render函数 后续每次数据更新 只执行render函数(不需要再次进行ast的转换)
    4. render函数执行 生成 vNode节点（会使用到响应式数据）
    5. 根据vNode 生成 真实dom 渲染页面
    6. 数据更新 重新执行render

## 数据劫持

**Vue2中使用的是Object.definedProperty**，**Vue3中直接使用Proxy了**

## 模板编译为ast

vue2中使用的是正则表达式进行匹配，然后转换为ast树。

模板引擎 性能差 需要正则匹配 替换 vue1.0 没有引入虚拟dom的改变，vue2 采用虚拟dom 数据变化后比较虚拟dom的差异 最后更新需要更新的地方， 核心就是我们需要将模板变成我们的js语法 通过js语法生成虚拟dom，语法之间的转换 需要先变成抽象语法树AST 再组装为新的语法，这里就是把template语法转为render函数。

### ast转render

把生成的ast语法树，通过字符串拼接等方式转为render函数。
render函数内部主要用到：

1. _c函数：创建元素虚拟dom节点
2. _v函数：创建文本虚拟dom节点
3. _s函数：将函数内的变量字符串化

### render函数生成真实dom

调用render函数，会生成虚拟dom，然后把虚拟dom转为真实DOM，挂载到页面即可。

## 回忆流程

**核心流程：**

1. 数据处理成响应式，在 initState中处理的（针对对象来说主要是definedProperty，数组则是重写七个方法）
2. 模板编译：先把模板转成ast语法树，再把语法树生成**render函数**
3. 调用render函数，可能会进行变量的取值操作(_s函数内有变量)，产生对应的虚拟dom
4. 虚拟dom渲染为真实dom，挂载到页面即可

**完成了，虚拟和真实dom的渲染，也完成了响应式数据的处理，接下来需要进行视图和响应式数据的关联，在渲染页面的时候，收集依赖数据。**

1. 使用观察者模式实现依赖收集
2. 异步更新策略
3. mixin的实现原理

### 模板的依赖收集

要完成依赖的收集，很明显的就是，我们要如何得知，此模板在此次渲染的时候，用到了那些响应式数据。

我们可以给模板中的属性，增加一个**收集器（dep）**。这个收集器，是给每个属性单独增加的。页面渲染的时候，我们把渲染逻辑封装到watcher中。（其实就是手动更新视图的那两个方法app._update(app._render())）。让dep记住这个watcher即可，在属性变化了以后，可以找到对应的dep中存放的watcher，然后执行重新渲染页面。

这里面我们用到的方式其实就是**观察者模式**。

```js
/**
 * watcher 进行实际的视图渲染
 * 每个组件都有自己的watcher，可以减少每次更新页面的部分
 * 给每个属性都增加一个dep，目的就是收集watcher
 * 一个视图（组件）可能有很多属性，多个属性对应一个视图 n个dep对应1个watcher
 * 一个属性也可能对应多个视图（组件）
 * 所以 dep 和 watcher 是多对多关系
 * 
 * 每个属性都有自己的dep，属性就是被观察者
 * watcher就是观察者（属性变化了会通知观察者进行视图更新）-> 观察者模式
 */
class Watcher{}
```

先让watcher收集dep，如果dep已经收集过，则不会再次收集。当dep被收集的时候，我们也会让dep反向收集当前的watcher。实现二者的双向收集。

然后在响应式数据发送改变的时候，通知dep的观察者（watcher）进行视图更新。

![image-20220415105750259](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220415105750259.png)

#### 视图同步渲染

此时，已经完成了响应式数据和视图的绑定，在数据发生改变的情况下，视图会同步更新。也就是说，我们更新了两次响应式数据，也会更新两次视图。

![image-20220415110028536](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220415110028536.png)

正常情况下，更新两次视图是没有问题的，但是此时两次数据的更新发生在一次同步代码中，我们应该让视图的更新是异步的，这样在一次操作更新多个数据的情况下，也只会渲染一次视图，提高渲染速率。

**那么我们的想法就是合并更新，在所有的更新数据做完以后，在刷新页面。也就是批处理，事件环。**

#### 事件环

我们的期望就是，同步代码执行完毕之后，在执行视图的渲染（作为异步任务）。把更新操作延迟。

方法就是使用一个队列维护需要更新的watcher，第一次更新属性值的时候，就开启一个定时器，清空所有的watcher。后续的数据改变的操作，都不会再次开启定时器，只是会把需要更新的watcher再次入队列。（当然watcher我们会先去重）。

但是这个清空操作是在同步代码执行完毕后才会执行的。

```js
// watcher queue 本次需要更新的视图队列
let queue = [];
// watcher 去重  {0:true,1:true}
let has = {};
// 批处理 也可以说是防抖
let pending = false;
/**
 * 不管执行多少次update操作，但是我们最终只执行一轮刷新操作
 * @param {*} watcher
 */
function queueWatcher(watcher) {
  const id = watcher.id;
  // 去重
  if (!has[id]) {
    queue.push(watcher);
    has[id] = true;
    console.log(queue);
    if (!pending) {
      // 刷新队列 多个属性刷新 其实执行的只是第一次 合并刷新了
      setTimeout(flushSchedulerQueue, 0);
      pending = true;
    }
  }
}
/**
 * 刷新调度队列 且清理当前的标识 has pending 等都重置
 * 先执行第一批的watcher，如果刷新过程中有新的watcher产生，再次加入队列即可
 */
function flushSchedulerQueue() {
  const flushQueue = [...queue];
  queue = [];
  has = {};
  pending = false;
  // 刷新视图 如果在刷新过程中 还有新的watcher 会重新放到queueWatcher中
  flushQueue.forEach((watcher) => watcher.run()); // run 就是执行render
}
```

#### nextTick

**原理：**

因为我们数据的更新和视图的更新不再是同步，导致我们在同步获取视图最新的dom元素时，可能出现获取的元素和视图实际显示的元素不一致的情况。于是出现了 **nextTick方法**

实际上：nextTick方法内部也是维护了一个异步回调队列，开启一个定时器，每次调用该方法传入回调，都是把回调函数放入队列，并不是每次调用nextTick方法都开启一个定时器（比较销毁性能）。再放入第一个回调函数的时候，开启定时器，后续的回调函数只放入队列而不会再次开启定时器了，。所以nextTick不是创建了异步任务，而是将这个任务维护到了队列而已。

**nextTick方法是同步还是异步？**

把任务（回调）放到队列是同步，实际执行任务是异步。

```js
// 任务队列
let callbacks = [];
// 是否等待任务刷新
let waiting = false;
/**
 * 刷新异步回调函数队列
 */
function flushCallbacks() {
  const cbs = [...callbacks];
  callbacks = [];
  waiting = false;
  cbs.forEach((cb) => cb());
}
/**
 * 异步批处理
 * 是先执行内部的回调 还是用户的？ 用个队列 排序
 * @param {Function} cb 回调函数
 */
export function nextTick(cb) {
  // 使用队列维护nextTick中的callback方法
  callbacks.push(cb);
  if (!waiting) {
    setTimeout(flushCallbacks, 0); // 刷新
    waiting = true;
  }
}
```

#### vue的nextTick

实际上，vue的nextTick方法，内部并没有直接使用原生的某一个异步api（比如promise，setTimeout等）。而是采用优雅降级的方法。

1. 内部先采用的是promise（ie不兼容）。
2. 有一个和Promise等价的 [MutationObserve](https://developer.mozilla.org/zh-CN/docs/Web/API/MutationObserver)。也是异步微任务。（此API是H5的，只能在浏览器中使用）
3. 考虑ie浏览器专享的 setImmediate API。性能比settimeout好一些
4. 最后直接上setTimeout

**采用优雅降级的目的，**还是为了用户可以尽快看见页面的渲染。

```js
/**
 * 优雅降级  Promise -> MutationObserve -> setImmediate -> setTimeout(需要开线程 开销最大)
 */
let timerFunc = null;
if (Promise) {
  timerFunc = () => Promise.resolve().then(flushCallbacks);
} else if (MutationObserver) {
  // 创建并返回一个新的 MutationObserver 它会在指定的DOM发生变化时被调用（异步执行callback）。
  const observer = new MutationObserver(flushCallbacks);
  // TODO 创建文本节点的API 应该封装 为了方便跨平台
  const textNode = document.createTextNode(1);
  console.log("observer-----------------")
  // 监控文本值的变化
  observer.observe(textNode, {
    characterData: true,
  });
  timerFunc = () => (textNode.textContent = 2);
} else if (setImmediate) {
  // IE平台
  timerFunc = () => setImmediate(flushCallbacks);
} else {
  timerFunc = () => setTimeout(flushCallbacks, 0);
}
```

对于vue3，肯定就不需要这种方式了，在不兼容ie的情况下，可以直接使用promise了。

![image-20220415150046818](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220415150046818.png)

经过一次次处理，现在是可以在视图更新以后再去拿最新的dom了。

当然：对于更改值放在取值的下面，那么获取到的肯定还是旧的dom值。vue也是如此的。

![image-20220415150347883](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220415150347883.png)

### mixin的实现

Vue的mixin，可以实现全局混入和局部混入。

全局混入对所有组件实例都生效。

**暂时我实现了生命周期的混入，对于data等其他特殊选项的合并还未处理。**

对于混入的生命周期，无论是一个还是多个相同的生命周期，最终我们都转为使用数组包裹，每个数组元素都是混入进来的生命周期。在创建组件实例的时候，把传入的选项和全局的Vue.options选项进行合并到实例上，实现混入效果。

![image-20220415220542253](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220415220542253.png)

### computed

**计算属性：**

计算属性：依赖的值发生改变 才会重新执行用户的方法 计算属性需要维护一个dirty属性。而且在默认情况下，计算属性不会立刻执行，而是在用户取值的时候才会执行。

计算属性使用的两种方式：

```js
computed: {
    /**
      * 计算属性：依赖的值发生改变 才会重新执行用户的方法 计算属性需要维护一个dirty属性
      */
    // 只有get的计算属性
    fullName1() {
        return this.firstName + " " + this.lastName
    },
        // getter and setter
        fullName2: {
            get() {
                return this.firstName + " " + this.lastName
            },
                set(newVal) {
                    [this.firstName, this.lastName] = newVal.split(" ")
                }
        }
}
```

**特点：**

1. 计算属性本身就是一个defineProperty，响应式数据
2. 计算属性也是一个Watcher，默认渲染会创造一个渲染watcher
3. 如果watcher中有lazy属性，表明这是一个计算属性watcher
4. 计算属性维护了一个dirty，当我们直接修改计算属性的值，或者修改了计算属性依赖的值，那么计算属性自己的值并不会直接发生改变，而是使dirty的值发生改变。
5. 当dirty为false的时候，表示依赖的值没有发生改变，不需要再次计算，直接使用上次缓存的值即可。
6. 计算属性自身不会收集依赖，而是让计算属性依赖的属性去收集依赖（watcher）

```js
/**
 * 初始化 computed
 * @param {Vue} vm 实例
 */
function initComputed(vm) {
  const computed = vm.$options.computed;
  const watchers = (vm._computedWatchers = {});
  for (const key in computed) {
    const userDef = computed[key];
    // function -> get
    // object -> {get(){}, set(newVal){}}
    let setter;
    const getter = isFunction(userDef)
      ? userDef
      : ((setter = userDef.set), getter);
    // 监控计算属性中 get的变化
    // 每次data的属性发生改变 重新执行的就是这个get
    // 传入额外的配置项 标明当前的函数 不需要立刻执行 只有在使用到计算属性了 才计算值
    // 把属性和watcher对应起来
    watchers[key] = new Watcher(vm, getter, { lazy: true });
    // 劫持每一个计算属性
    defineComputed(vm, key, setter);
  }
}
/**
 * 定义计算属性
 * @param {*} target
 * @param {*} key
 * @param {*} setter
 */
function defineComputed(target, key, setter) {
  Object.defineProperty(target, key, {
    // vm.key -> vm.get key this -> vm
    get: createComputedGetter(key),
    set: setter,
  });
}
/**
 * vue2.x 的计算属性 不会收集依赖，只是让计算属性依赖的属性去收集依赖
 * 创建一个懒执行（有缓存的）计算属性 判断值是否发生改变
 * 检查是否需要执行这个getter
 * @param {string} key
 */
function createComputedGetter(key) {
  // this -> vm 因为返回值给了计算属性的 get 我们是从 vm上取计算属性的
  return function lazyGetter() {
    // 对应属性的watcher
    const watcher = this._computedWatchers[key];
    if (watcher.dirty) {
      // 如果是脏的 就去执行用户传入的getter函数 watcher.get()
      // 但是为了可以拿到get的执行结果 我们调用 evaluate函数
      watcher.evaluate(); // dirty = false
    }
    // 计算属性watcher出栈后 还有渲染watcher（在视图中使用了计算属性）
    // 或者说是在其他的watcher中使用了计算属性
    if (Dep.target) {
      // 让计算属性的watcher依赖的变量也去收集上层的watcher
      watcher.depend();
    }
    return watcher.value;
  };
}
```

![image-20220416140102371](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220416140102371.png)

![image-20220416140057050](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220416140057050.png)

### watch的实现

watch选项是一个对象，每个watch的属性作为键，

1. 如果watch的属性直接是一个函数，那么会在属性值发生改变后，给该函数传入两个参数，新值和旧值。

   ```js
   // 就是一个观察者
   firstName(newVal, oldVal) {
       console.log(newVal, oldVal)
   }
   ```

2. watch的属性是一个数组，数组元素可以是直接定义的函数，也可以是methods中的字符串函数名

   ```js
   // 就是一个观察者
   firstName:[
       function (newVal, oldVal) {
       console.log(newVal, oldVal)
   },
       function (newVal, oldVal) {
       console.log(newVal, oldVal)
   }
             ]
   ```

3. watch也可以是一个methods中的字符串函数名

4. vm.$watch，上面三种的定义方式，最终都是转为vm.$watch的形式

   ```js
   const unwatch  = vm.$watch(()=>vm.firstName, (newVal)=>{},options)// 额外选项options
   // 取消watch
   unwatch()
   
   vm.$watch(() => vm.firstName + vm.lastName, (newVal) => {
         console.log("类似侦听未定义的计算属性了",newVal)
       })
       // 是字符串 则不需要再属性前加vm
       vm.$watch("firstName", (newVal) => {
         console.log(newVal)
       })
   ```

   ![image-20220416160038397](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220416160038397.png)

![image-20220416160128191](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220416160128191.png)

### 数组和对象元素更新实现原理

在vue中，我们知道数组有七个变异方法（会修改数组自身元素的方法），vue对这七个方法实现了重写，不然正常情况下我们使用这七个方法是没有办法实现响应式更新视图的。

而且对于一个对象，如果我们修改的是对象已经在data中定义好的对象的属性，当然是可以进行响应式更新的，但是，如果我们新增一个属性，视图是没有办法实现响应式更新的。

正常情况下，只有我们让数组属性的值变为一个新数组，或者对象属性变为一个新对象，这样才能让对于没有劫持的数组元素或者对象属性给劫持下来。

![image-20220416172738629](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220416172738629.png)

```js
// 数组数据响应式更新原理
const vm = new Vue({
    data: {
        arr: ["海贼王", "火影忍者", "名侦探柯南"],
        obj: { name: "张三" }
    },
    el: "#app",
    // 模板编译为虚拟dom的时候，从arr对象取值了 _v(_s(变量)) JSON.stringify() 
    // 所以对象会收集依赖
    template: `
<div id="app">
<ul>
<li>{{arr[0]}}</li>
<li>{{arr[1]}}</li>
<li>{{arr[2]}}</li>
<li>{{obj}}</li>
</ul>
</div>
`
})
setTimeout(() => {
    // 这种修改方式无法监控
    vm.arr[1] += 1
    // 也不会刷新视图
    vm.arr.length = 10;
    // 7个数组的变异方法可以监控到 因为我们重写了
    // 这里并没有改变 arr属性 只是改变了arr这个数组对象
    // arr数组对象自身并没有改变（没有变成新数组，地址没改变）
    vm.arr.push("12")
    vm.obj.age = 22
    console.log("1秒后更新。。。",vm.arr,vm.obj)
}, 1000)
```

**所以我们为了能劫持修改数组自身和给对象新增属性等，也可以被Vue劫持，我们需要在数组，对象等引用类型的属性上，也让其自身具有dep，不仅仅是对象的属性，数组的元素等需要被劫持，数组，对象等自身也需要被劫持。**

也就是说：不管这个属性是原始类型，还是引用类型，都让其对应一个dep，用来收集依赖。

```js
class Observe {
  constructor(data) {
    // 让引用数据自身也实现依赖收集 这个dep是放在 data.__ob__ = this 上的
    // 也就是说 data.__ob__.dep 并不是 data.dep 所以不会发生重复
    this.dep = new Dep();
    // 记录this 也是一个标识 如果对象上有了该属性 标识已经被观测
    Object.defineProperty(data, "__ob__", {
      value: this, // observe的实例
    });
    // 如果劫持的数据是数组
    if (Array.isArray(data)) {
      // 重写数组上的7个方法 这7个变异方法是可以修改数组本身的
      Object.setPrototypeOf(data, arrayProto);
      // 对于数组元素是 引用类型的，需要深度观测的
      this.observeArray(data);
    } else {
      // Object.defineProperty 只能劫持已经存在的属性（vue提供单独的api $set $delete 为了增加新的响应式属性）
      this.walk(data);
    }
  }
  /**
   * 循环对象 对属性依次劫持 重新‘定义’属性
   * @param {*} data
   */
  walk(data) {
    Object.keys(data).forEach((key) => defineReactive(data, key, data[key]));
  }
  /**
   * 劫持数组元素 是普通原始值不会劫持
   * @param {Array} data
   */
  observeArray(data) {
    data.forEach((item) => observe(item));
  }
}
```

![image-20220416175015018](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220416175015018.png)

![image-20220416175053115](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220416175053115.png)

可以看见，修改数组自身的元素，视图也能正常更新。

**但是要注意，直接使用arr[index]的方式修改元素，和新增对象还不存在的元素，目前还不能进行视图更新。**

![image-20220416175343403](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220416175343403.png)

也就是说目前只是修改数组自身的7个变异方法，可以劫持到，并且实现视图更新。对于使用下标修改元素和修改数组的长度等，是不能劫持到的。

**对于新增属性，需要使用vm.$set()方法新增才能实现劫持。**

通过上面的操作，给每个对象的观察者observe都挂上了一个dep，用来收集每个对象自身的依赖。

当我们给对象新增属性的时候，可以observe通知dep更新视图。

```js
setTimeout(() => {
    vm.obj.age = 22
    vm.obj.__ob__.dep.notify()//$set原理
    console.log("1秒后更新。。。",vm.arr,vm.obj)
    }, 1000)
```

**$set本质上就是这种原理实现的。**

#### 深度数据劫持

对于数组元素还是数组的这种情况，需要二次侦听。

![image-20220416202926167](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220416202926167.png)

```js
function dependArray(arr) {
  // console.log(arr);
  for (let i = 0; i < arr.length; i++) {
    const cur = arr[i];
    // console.log(cur, cur.__ob__);
    // 数组元素可能不是数组了
    if (Array.isArray(cur)) {
      // 收集依赖
      cur.__ob__.dep.depend();
      dependArray(cur);
    }
  }
}
```

把数组元素循环，对于元素还是数组的情况，让该数组自身也收集依赖。

**数据劫持总结：**

1. 默认vue在初始化的时候 会对对象每一个属性都进行劫持，增加dep属性， 当取值的时候会做依赖收集

2. 默认还会对属性值是（对象和数组的本身进行增加dep属性） 进行依赖收集

3. 如果是属性变化 触发属性对应的dep去更新

4. 如果是数组更新，触发数组的本身的dep 进行更新

5. 如果取值的时候是数组还要让数组中的对象类型也进行依赖收集 （递归依赖收集）

6. 如果数组里面放对象，默认对象里的属性是会进行依赖收集的，因为在取值时 会进行JSON.stringify操作

![image-20220416203346466](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220416203346466.png)

## diff算法

diff算法：

在之前的更新中，每次数据更新，在更新视图时，都是完全产生新的虚拟节点，通过新的虚拟节点生成真实节点，用新生成的真实节点替换所有的老节点。

这种方法在页面元素很少的情况下性能销毁倒是无所谓，但是在页面元素特别多情况下，很明显是消耗很大性能的。哪怕我只是修改了一个dom的文本内容，也都需要重新生成一遍所有节点。（因为现在只有一个组件）

第一次渲染的时候，我们会产生虚拟节点，第二次更新我们也会调用render方法产生新的虚拟节点，我们需要对比两次的vnode，找到需要更新的部分进行更新。

#### 没有key

对于没有key的情况下：vue会在两个vnode的tag相同的时候，就任务是同一个节点。这种情况下可能会出现错误复用。

```html
<ul>
    <li>1</li>
    <li>2</li>
    <li>3</li>
</ul>
<!--更新后-->
<ul>
    <li>2</li>
    <li>3</li>
    <li>1</li>
</ul>
```

此时vue只会让第一个节点和第一个节点比较，第二个节点和第二个节点比较。

### 有key

vue在进行diff的时候（新旧虚拟dom都有子节点数组），维护了一个双指针，来进行比较。

```js
// 我们为了比较两个儿子的时候，提高比较的性能（速度）
  /**
   * 1. 我们操作列表 经常会有 push pop shift unshift sort reverse 等方法 针对这些情况可以做一些优化
   * 2. vue2中采用双指针的方法 比较两个节点
   */
  let oldStartIndex = 0,
    oldEndIndex = oldChildren.length - 1,
    newStartIndex = 0,
    newEndIndex = newChildren.length - 1,
    oldStartVnode = oldChildren[oldStartIndex],
    oldEndVnode = oldChildren[oldEndIndex],
    newStartVnode = newChildren[newStartIndex],
    newEndVnode = newChildren[newEndIndex];
```

#### old head -> new head

新旧节点都进行头指针指向的头结点比较。如果两个子节点相同，则会进行复用。

```html
<ul>
    <li key="a">1</li>
    <li key="b">2</li>
    <li key="c">3</li>
</ul>
<!--更新后-->
<ul>
    <li key="a">1</li>
    <li key="b">2</li>
    <li key="d">4</li>
</ul>
```

此时vue会复用前两个节点（比对后发现前两个节点都不需要更改），只需要在原来的dom元素上追加一个子元素而已。

#### old tail -> new tail

在头结点进行比较时，发现不是一个节点，则再次比较两个children的尾节点。

```html
<ul>
    <li key="a">1</li>
    <li key="b">2</li>
    <li key="c">3</li>
</ul>
<!--更新后-->
<ul>
    <li key="b">2</li>
    <li key="c">3</li>
</ul>
```

在头结点不同，尾节点相同的情况下，会一直比较尾节点，发现相同则复用，到下一轮循环发现头节点还是不一致，继续比对尾节点。此时页面渲染也只是会删除一个旧的dom。

#### 交叉比对

##### old head -> new tail

在头结点和尾节点都不同的情况下，去比对旧vnode的头结点和新vnode的尾节点。

```html
<ul>
    <li key="a">1</li>
    <li key="b">2</li>
    <li key="c">3</li>
</ul>
<!--更新后-->
<ul>
    <li key="b">2</li>
    <li key="c">3</li>
    <li key="a">1</li>
</ul>
```

比较旧vnode的头节点和新vnode的尾节点发现一样，则进行复用，只需要移动dom元素的位置到其应该在的位置即可。

此时会复用这三个节点，只是会把第一个li移动到最后。

##### old tail -> new head

比较旧vnode的尾节点和新vnode的头结点，一样则也会复用节点。

```html
<ul>
    <li key="a">1</li>
    <li key="b">2</li>
    <li key="c">3</li>
</ul>
<!--更新后-->
<ul>
    <li key="c">3</li>
    <li key="b">2</li>
    <li key="a">1</li>
</ul>
```

此时也只是移动三个节点中key为a和c这两个dom元素的位置。

#### 乱序比较

当前面四种情况都不符合，恭喜了，已经没办法优化了，或者说再想办法优化并不是那么划算了。因为这个时候我们已经需要拿新vnode中的每个节点，去和旧vnode中的每个节点依次比对，此时的时间复杂度已经是O(N^2)了。算是很高的复杂度了。

先根据旧节点vnode集合生成一个key和节点所在索引的map。

```js
/**
 * 生成映射表
 * @param {*} children
 * @returns
 */
function makeIndexByKey(children) {
  const map = {};
  children.forEach((child, index) => (map[child.key] = index));
  return map;
}
```

我们让新vnode的每个节点，都拿出key去这个map中找旧节点的索引，如果找到则可以复用，找不到则需要创建新的dom元素然后插入到指定位置；如果找到了，则移动这个节点到指定位置，并且标识当前节点已经使用。

```js
const map = makeIndexByKey(oldChildren);
// ...
// 乱序比对 a b c ->  d e a b f
      /**
       * 根据老的列表做一个映射关系，用新的去找，找到则移动节点，找不到就新增节点，最后移除多余节点
       */
      // 如有值：则是需要移动的节点的索引
let moveIndex = map[newStartVnode.key];
if (moveIndex !== undefined) {
    const moveVnode = oldChildren[moveIndex];
    // 移动节点到头指针所在节点的前面
    insertBefore(el, moveVnode, oldStartVnode.el);
    // 标识这个节点已经移动过
    oldChildren[moveIndex] = undefined;
    patchVnode(moveVnode, newStartVnode);
} else {
    // 找不到 这是新节点 创建 然后插入进去 完事
    insertBefore(el, createEle(newStartVnode), oldStartVnode.el);
}
newStartVnode = newChildren[++newStartIndex];
```

此时，就完成了所有diff算法的步骤。

```html
<ul>
  <li key="a">1</li>
  <li key="b">2</li>
  <li key="c">3</li>
  <li key="d">4</li>
</ul>

<ul>
<li key="g">6</li>
<li key="f">5</li>
<li key="h">7</li>
<li key="a">1</li>
<li key="c">3</li>
<li key="b">2</li>
</ul>
```

这种复杂的也能实现dom复用了。

**此时对于key来说，是不能出现重复的。否则会报错。**

**核心代码：**大概一百行左右吧。

```js
function patchVnode(oldVNode, vnode) {
  /**
   * 1. 两个节点不是同一个节点，直接删除老的换上新的（不在继续对比属性等）
   * 2. 两个节点是同一个节点（tag，key都一致），比较两个节点的属性是否有差异
   * 复用老节点，将差异的属性更新
   */
  const el = oldVNode.el;
  // 不是同一个节点
  if (!isSameVNode(oldVNode, vnode)) {
    // tag && key
    // 直接替换
    const newEl = createEle(vnode);
    replaceChild(el.parentNode, newEl, el);
    return newEl;
  }
  // 文本的情况 文本我们期望比较一下文本的内容
  vnode.el = el;
  if (!oldVNode.tag) {
    if (oldVNode.text !== vnode.text) {
      textContent(el, vnode.text);
    }
  }
  // 是标签 我们需要比对标签的属性
  patchProps(el, oldVNode.props, vnode.props);
  // 有子节点
  /**
   * 1.旧节点有子节点 新节点没有
   * 2. 都有子节点
   * 3. 旧节点没有子节点，新节点有
   */
  const oldChildren = oldVNode.children || [];
  const newChildren = vnode.children || [];
  const oldLen = oldChildren.length,
    newLen = newChildren.length;
  if (oldLen && newLen) {
    // 完整的diff 都有子节点
    updateChildren(el, oldChildren, newChildren);
  } else if (newLen) {
    // 只有新节点有子节点 挂载
    mountChildren(el, newChildren);
  } else if (oldLen) {
    // 只有旧节点有子节点 全部卸载
    unmountChildren(el, oldChildren);
  }
  return el;
}
/**
 * 对比更新子节点
 * @param {*} el
 * @param {*} oldChildren
 * @param {*} newChildren
 */
// TODO 对于出现重复的key，有bug，还未修复。。。。
function updateChildren(el, oldChildren, newChildren) {
  // 我们为了比较两个儿子的时候，提高比较的性能（速度）
  /**
   * 1. 我们操作列表 经常会有 push pop shift unshift sort reverse 等方法 针对这些情况可以做一些优化
   * 2. vue2中采用双指针的方法 比较两个节点
   */
  let oldStartIndex = 0,
    oldEndIndex = oldChildren.length - 1,
    newStartIndex = 0,
    newEndIndex = newChildren.length - 1,
    oldStartVnode = oldChildren[oldStartIndex],
    oldEndVnode = oldChildren[oldEndIndex],
    newStartVnode = newChildren[newStartIndex],
    newEndVnode = newChildren[newEndIndex];
  // 乱序比较时 使用的映射表 {key:"节点在数组中的索引"} -> {a:0,b:1,...}
  const map = makeIndexByKey(oldChildren);
  // 循环比较 只要头指针不超过尾指针 就一直比较
  while (oldStartIndex <= oldEndIndex && newStartIndex <= newEndIndex) {
    // 排除 undefined 的情况
    if (!oldStartVnode) oldStartVnode = oldChildren[++oldStartIndex];
    if (!oldEndVnode) oldEndVnode = oldChildren[--oldStartIndex];
    /**
     * 1. old head -> new head
     * 2. old tail -> new tail
     * 3. old head -> new tail
     * 4. old tail -> new head
     */
    // 进行节点比较
    else if (isSameVNode(oldStartVnode, newStartVnode)) {
      // 头结点相同
      // 从头指针开始比较两个节点
      // 相同节点 递归比较子节点
      patchVnode(oldStartVnode, newStartVnode);
      oldStartVnode = oldChildren[++oldStartIndex];
      newStartVnode = newChildren[++newStartIndex];
    } else if (isSameVNode(oldEndVnode, newEndVnode)) {
      // 尾节点相同
      // 从尾指针开始比较两个节点
      patchVnode(oldEndVnode, newEndVnode);
      oldEndVnode = oldChildren[--oldEndIndex];
      newEndVnode = newChildren[--newEndIndex];
    }
    // 交叉比对 两次头尾比较
    //  a b c -> c a b 把尾节点移动到头结点之前
    else if (isSameVNode(oldEndVnode, newStartVnode)) {
      patchVnode(oldEndVnode, newStartVnode);
      console.log(oldEndVnode, newStartVnode);
      // 将老节点的尾节点插入到老节点头结点（头结点会变化）的前面去
      insertBefore(el, oldEndVnode.el, oldStartVnode.el);
      oldEndVnode = oldChildren[--oldEndIndex];
      newStartVnode = newChildren[++newStartIndex];
    }
    // a b c d -> d c b a 头结点移动到尾节点后面
    else if (isSameVNode(oldStartVnode, newEndVnode)) {
      patchVnode(oldStartVnode, newEndVnode);
      insertBefore(el, oldStartVnode.el, oldEndVnode.el.nextSibling);
      oldStartVnode = oldChildren[++oldStartIndex];
      newEndVnode = newChildren[--newEndIndex];
    } else {
      // 乱序比对 a b c ->  d e a b f
      /**
       * 根据老的列表做一个映射关系，用新的去找，找到则移动节点，找不到就新增节点，最后移除多余节点
       */
      // 如有值：则是需要移动的节点的索引
      let moveIndex = map[newStartVnode.key];
      if (moveIndex !== undefined) {
        const moveVnode = oldChildren[moveIndex];
        // 移动节点到头指针所在节点的前面
        insertBefore(el, moveVnode, oldStartVnode.el);
        // 标识这个节点已经移动过
        oldChildren[moveIndex] = undefined;
        patchVnode(moveVnode, newStartVnode);
      } else {
        // 找不到 这是新节点 创建 然后插入进去 完事
        insertBefore(el, createEle(newStartVnode), oldStartVnode.el);
      }
      newStartVnode = newChildren[++newStartIndex];
    }
  }
  // 新节点的比旧节点多 挂载
  if (newStartIndex <= newEndIndex) {
    for (let i = newStartIndex; i <= newEndIndex; i++) {
      // 这里可能是向后追加 也可能是向前插入
      // 判断当前的虚拟dom后面是否还有节点 有节点则是插入到该节点前面
      const anchor = newChildren[newEndIndex + 1]?.el;
      // 注意：插入方法在 要插入的那个节点不存在的情况下，自动变为追加方法 appendChild
      insertBefore(el, createEle(newChildren[i]), anchor);
    }
  }
  // 旧节点比新节点多 卸载
  if (oldStartIndex <= oldEndIndex) {
    for (let i = oldStartIndex; i <= oldEndIndex; i++) {
      // 乱序比对时 可能已经标记为 undefined了
      oldChildren[i] && removeChild(el, oldChildren[i].el);
    }
  }
}
/**
 * 生成映射表
 * @param {*} children
 * @returns
 */
function makeIndexByKey(children) {
  const map = {};
  children.forEach((child, index) => (map[child.key] = index));
  return map;
}
```

### 为什么需要key

直接将新节点替换老节点，很消耗性能，所以我们不直接替换，而是在比较两个节点之间的区别之后在替换，这就是diff算法。

diff算是 是一个平级比较的过程，父亲和父亲节点比对 儿子和儿子节点比对。

我们在比较两个虚拟dom是否一致的时候，是根据虚拟dom的标签名和key值来进行比较的。如果没有key，相当于只要标签名一致，我我们就认为这两个虚拟节点是一样的，然后判断其子元素...

当我们在遍历动态列表，给其增加key的时候，要尽量避免使用索引作为key，因为两次的虚拟dom的key都是从0开始的，可能会发生错误复用。

**注意：在vue和react中，我们说的key要唯一，实际上是在同级的vnode情况下（也就是兄弟节点这些），并不意味着key需要全局唯一。**

## 实现组件

Vue中，一般一个项目只有一个根组件，也就是 new Vue产生的app。

但是一个页面不可能只由一个组件构成，很明显我们需要实现自定义组件。

vue中提供了两种自定义组件的方式：

1. 全局组件
2. 局部组件

**组件的使用流程：**

在任意一个组件中，都可以使用其他组件。当我们在一个组件中使用其他组件的时候，会先去组件内部的局部组件中找是否定义过该组件，如果定义了，则直接使用该局部组件；如果没有定义局部组件，则去全局组件中寻找（和js中的原型，原型链很像了）。所以vue内部很可能也是利用类似于继承的这种模型实现组件的定义的。

其实vue内部在定义组件的时候，表面上我们是传递了一个对象：

```js
Vue.component("cmp",{
    //...
})
```

实际上这个对象内部也会被Vue.extend给包裹，变成`子类`.

```js
Vue.component("cmp",Vue.extend({
    //...
}))
```

### 组件的三大特性

1. 自定义标签
2. 组件有自己的属性和事件
3. 组件的插槽

### Vue.extend的实现

既然组件的实现内部还是需要调用extend方法，那么就先把extend实现出来。

**用法：**使用基础 Vue 构造器，创建一个“子类”。参数是一个包含组件选项的对象。

**实现：**

这个实现就不难了：不过就是实现一个构造函数，让该函数继承Vue而已。就是组合式继承。

```js
/**
   * 使用基础 Vue 构造器，创建一个“子类”。参数是一个包含组件选项的对象。
   * 返回值是一个构造函数 通过new可以创建一个vue组件实例
   * @param {{data:Function,el:string}} options
   * @returns
   */
Vue.extend = function (options) {
    // 组合式继承 Vue
    function Sub(options = {}) {
        // 最终使用的组件 就是 new 一个实例
        this._init(options);
    }
    Sub.prototype = Object.create(Vue.prototype);
    Object.defineProperty(Sub.prototype, "constructor", {
        value: Sub,
        writable: true,
        configurable: true,
    });
    Sub.options = options; // 保存用户传递的选项
    return Sub;
};
```

![image-20220417223435741](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220417223435741.png)

### Vue.component实现

**参数：**

- id: string
- definition?: Function | object

**用法：**注册或获取全局组件。注册还会自动使用给定的 `id` 设置组件的名称

```js
// 注册组件，传入一个扩展过的构造器
Vue.component('my-component', Vue.extend({ /* ... */ }))

// 注册组件，传入一个选项对象 (自动调用 Vue.extend)
Vue.component('my-component', { /* ... */ })

// 获取注册的组件 (始终返回构造器)
var MyComponent = Vue.component('my-component')
```

**实现：**

```js
// 维护一个 全局组件对象
  Vue.options.components = {};
  /**
   * 定义或者获取全局组件 没有获取到组件时 返回 undefined
   * @param {string} id
   * @param {Function | object} definition
   */
  Vue.component = function component(id, definition) {
    // 获取全局组件
    if (!definition) return Vue.options[id];
    // 如果 definition 是一个函数，说明用户自己调用了 Vue.extend
    // 不是函数 就用 extend函数包装一下
    !isFunction(definition) && (definition = Vue.extend(definition));
    Vue.options.components[id] = definition;
  };
```

实现全局的组件注册并不难，其核心还是利用了extend方法。

### 全局component和局部component

对于一个组件中，我们如果使用了一个其他组件，且在全局和局部都注册了一个同名的组件，那么我们会优先使用哪个？vue中会优先使用组件内部注册的局部组件。

我们在处理创建组件时的配置的时候，要维护一下：`components:{"btn":{}}.__proto__ -> Vue.options.components`

```js
const Cmp = Vue.extend({
    template: `<div>
<h2>你好!{{name}}</h2>
<btn/>
</div>`,
    components:{
        btn:{
            template:`<button>局部button</button>`
        }
    }
});
Vue.component("btn",{
    template:`<button>全局button</button>`
})
const cmp = new Cmp({
    data: {
        name: "张三"
    }
})
cmp.$mount("#app")
```

我们需要修改一下当时extend和合并选项的部分代码实现：

![image-20220417233341024](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220417233341024.png)

![image-20220417233534097](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220417233534097.png)

**不过这样还是有一些小bug，我觉得这样实现就更加完美了。**不过在vue中的实现方式还是上面那种。

把合并策略再次修改一下：

```js
strategy.components = function (parentVal, childVal) {
  // 已经和全局组件对象创建关系了，则不需要再次建立关系 直接返回
  if (Object.getPrototypeOf(parentVal) === Vue.options.components)
    return parentVal;
  // 通过父亲 创建一个对象 原型上有父亲的所有属性和方法
  const res = Object.create(parentVal); // {}.__proto__ = parentVal
  if (childVal) {
    for (const key in childVal) {
      // 拿到所有的孩子的属性和方法
      res[key] = childVal[key];
    }
  }
  return res;
};
```

![image-20220417235410784](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220417235410784.png)

**实现了组件的寻找规则，接下来只需要在组件的模板解析时，去寻找组件并渲染子组件。**

之前我们都是模板生成ast以后，然后生成虚拟dom，下一步就是比对节点生成真实dom了。

但是当我们引入组件以后，就需要对元素再次分类，分类出组件的虚拟节点和其他的普通节点。

我们需要在生成vnode的时候，判断出该标签是原始标签还是自定义组件的标签。

一个朴素无华的操作就是判断此tag是否是所有原始标签的一种。。。

```js
const ReservedTags = [
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "span",
  "ul",
  "ol",
  "li",
  "a",
  "table",
  "button",
  "input",
];

const isReservedTag = (tag) => {
  return ReservedTags.includes(tag);
};
```

#### 渲染流程

**Vue.component**的作用就是进行组件的全局定义而已。把id和definition对应。让   Vue.options.componnets[id] = definition。只是如果definition是对象的情况下，会帮我们使用extend进行包裹成构造函数（Vue子类）。

- Vue.extend返回值就是一个Vue子类，一个继承了父类Vue的构造函数。（为什么Vue的组件中的data不能是一个对象呢？）

```js
Vue.extend({
    data:{}
})
```

![image-20220418124139726](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418124139726.png)

我们在实例化这个返回的子类的时候，也就是 new Sub，会调用父亲Vue上的_init方法，然后在该方法的内部，又会进行mergeOptions合并选项的操作。也就是每次合并选项，都会把子类上的options都拿一份放到实例自己的$options上。如果data是一个对象，那么每次都会把data的引用放到实例对象自己身上。

多个子类实例会共享一个Sub上的options.data。但是如果data是一个函数，我们虽然也是直接把data放到实例对象的身上，但是在初始化属性拦截数据的时候，发现data是一个函数的情况下，我们会执行这个函数，拿到真正的data数据。每次执行函数返回的都是一个全新的对象，哪怕每个对象的所有属性都一样，但是他们直接不会相互影响。

在创建子类的构造函数的时候，会把全局的组件和自己身上定义的组件进行合并（组件的合并规则，先找自己身上是否有该组件，没有的情况下，然后去全局查找）

**组件的渲染：**

开始渲染的组件会编译组件的模板，变成render函数。然后调用render方法。

createElementVNode会根据tag类型来区分否是普通节点和组件节点。

![image-20220418125436483](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418125436483.png)

对于组件节点：我们在创建的时候，会给一个标识，包含组件的构造函数。且在data中增加一个初始化的init钩子。

![image-20220418125529930](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418125529930.png)

稍后在创建组件对应的真实节点的时候，只需要new Ctor即可。

**创建真实节点：**

在创建真实节点的时候，也就是在*createEle*方法内部，我们可以调用createComponent方法来创建组件。如果是组件，当然就会调用上面创建组件的虚拟节点的时候，插入的init的hook。然后返回组件生成的$el；不是组件当然也无伤大雅，会不满足组件的条件，正常往普通组件的流程往下走。

```js
function createComponent(vnode) {
  // init 初始化组件
  vnode.props?.hook?.init(vnode);
  return vnode.componentInstance;
}
```

![image-20220418135730777](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418135730777.png)

![image-20220418141046739](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418141046739.png)

所以到此为止，就实现了组件的渲染流程。

![image-20220418141303290](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418141303290.png)

## 源码阅读

1. 安装源码依赖 *npm install*
2. *npm run dev*是否可以打包成功

**代码结构：**

- bechmarks：该目录是做性能测试的
- dist：最终打包的结果都放到了该目录
- examples：官方案例
- flow：类型检测（vue2使用，类似于ts，但是没有ts好用）
- packages：放的都是一些源代码包，模块。（vue源码中包含了weex）
- scripts：所有打包的脚本都放在这里
- scr：源代码目录

**scr目录：**

- compiler：模板编译
- core：vue2核心代码包
- platforms：平台，跨平台使用
- server：ssr服务端渲染
- sfc：单文件组件，解析单文件模板（需要结合vue-loader使用的）
- shared：模块之间共享的属性和方法

找打包入口：配置文件，scripts/config.js

![image-20220418151526038](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418151526038.png)

![image-20220418152806333](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418152806333.png)

![image-20220418152828840](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418152828840.png)

打包入口：

我们只关心两个：

1. web/entry-runtime.js
2. web/entry-runtime-with-compiler.js

然后找到配置文件的真实位置

```js
const aliases = require('./alias')
// web/entry-runtime-with-compiler.js
const resolve = p => {
  // web, entry-runtime-with-compiler.js
  const base = p.split('/')[0]
  if (aliases[base]) {
    // web: resolve('src/platforms/web')
    // src/platforms/web/entry-runtime-with-compiler.js
    // 找别名 然后文件找到绝对路径
    return path.resolve(aliases[base], p.slice(base.length + 1))
  } else {
    return path.resolve(__dirname, '../', p)
  }
}
```

**src/platforms/web/entry-runtime-with-compiler.js**

![image-20220418153644469](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418153644469.png)

**两个入口文件的区别：**

**entry-runtime-with-compiler**文件就是重写了 `$mount`方法，支持把template转为render函数了。

![image-20220418160310001](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418160310001.png)

当然，这两文件也并不是真正的入口，

![image-20220418160638161](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418160638161.png)

去往runtime包。这个包提供的就是运行时vue是如何处理的。

所谓的运行时，会提供一些dom操作的api，比如属性操作，元素操作，也提供了一些组件和指令。

![image-20220418161007727](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418161007727.png)

![image-20220418161410125](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418161410125.png)

前往Vue构造函数所在的文件：

- 从web/runtime/index前往 core/index.js，发现这个文件也不是入口

![image-20220418161639292](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418161639292.png)

- globalAPI实现了很多全局API

- 接下来去往instance/index文件，这里是Vue真正的入口文件，有Vue构造函数了。

![image-20220418161937282](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418161937282.png)

![image-20220418162346437](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418162346437.png)

### 源代码调试

想知道每一个具体是如何实现的：

1. 掌握了核心流程，可以单独去看源码
2. 不知道核心流程，可以写一些测试用例，或者写一些案例来调试源代码

我们在打包时，需要生成sourcemap文件进行ES6-ES5的联调，关联源码调试

```json
"script":{
    "dev": "rollup -w -c scripts/config.js --environment TARGET:web-full-dev --sourcemap",
}
```

![image-20220418165626568](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418165626568.png)

不知道源码的核心流程，就在浏览器这里打断点调试，知道流程可以去对应的源码部分打断点调试。

## 源码调试

### Vue源码的global-api

![image-20220418170255108](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418170255108.png)

#### extend

![image-20220418170745311](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220418170745311.png)

### Vue面试题结合源码

> 1. 请说一下 `vue`响应式数据的理解
> 2. `Vue`中如何检测数组变化？
> 3. `Vue`中如何进行依赖收集？
> 4. 如何理解`Vue`中的模板编译原理
> 5. `Vue`生命周期钩子是如何实现的
> 6. `Vue`的生命周期方法有哪些？一般在哪一步发送请求及其原因
> 7. `Vue.mixin`的使用场景和原理
> 8. `Vue`组件data为什么必须是个函数？
> 9. `nextTick`在哪里使用？使用原理？
> 10. `computed`和`watch`的区别
> 11. `Vue.set`方法是如何实现的
> 12. `Vue`为什么需要虚拟dom
> 13. `Vue`中`diff`算法原理
> 14. 既然`Vue`通过数据劫持可以精准探测数据变化，为什么还需要虚拟dom进行`diff`检测差异
> 15. 请说明`Vue`中key的作用和其原理，谈谈你对它的理解
> 16. 谈谈对`Vue`组件化的理解
> 17. `Vue`组件的渲染流程
> 18. `vue`组件的更新流程
> 19. `vue`中异步组件原理
> 20. 函数式组件的优势及其原理
> 21. `vue`组件间传值的方式及之间的区别
> 22. `v-if`和`v-for`那个优先级搞
> 23. `v-if`,`v-model`,`v-for`的实现原理是什么
> 24. `Vue`中的`slot`是如何实现的？什么时候使用它？
> 25. `Vue.use`是干什么的？原理是什么？
> 26. `Vue`事件修饰符有哪些？及其实现原理是什么？
> 27. `Vue`中的 `.sync` 修饰符的作用，用法及其实现原理
> 28. 如何理解自定义指令
> 29. `keep-alive`平时在哪里使用？原理是什么
> 30. 组件中写`name`选项有哪些好处及作用？

#### 请说一下 `vue`响应式数据的理解

可以监控一个数据的修改和获取操作。针对对象格式会给每个对象的属性进行劫持。其使用了Object.difineProperty方法。

关于vue的响应式原理我是有书写过的。内部就是在递归的劫持引用类型的属性，在属性也是引用类型的情况下会再次拦截。

**回答该问题：**

1. 需要先找到基本的问题在哪
2. 源码层面回答
3. 使用的时候可能会伴随什么问题（就是踩坑）

**源码层面：**

1. 先走 InitData方法
2. observe
3. defineReactive方法（内部对所有属性进行了重写，肯定是有性能消耗的）
4. 在3中递归的观测引用类型的数据，给对象增加getter和setter

我们在使用vue的时候，如果data数据层级过深，需要考虑优化。比如：

1. 数据不是响应式的，没必要放到data中

2. 属性取值的时候，尽量避免多次取值

   ```js
   for(let i = 0; i < 100; i++){
    this.count++
   }
   // 优化 只会取值一次
   let count = this.count
   for(let i = 0; i < 100; i++){
    count++
   }
   ```

3. 如果有些对象是放到data中的，但是不需要是响应式的，可以考虑采用Object.freeze()冻结对象。冻结的对象Vue是不会进行观测的（一般这种对象都是会在模板中使用的数据）

   ![image-20220419223102194](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220419223102194.png)

**源码分析：**

new Vue的时候，来到了核心方法 **_init**。在该方法的 initState 方法用来初始化所有的状态信息。

![image-20220419225657891](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220419225657891.png)

初始化data

![image-20220419230122916](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220419230122916.png)

来到initData，该方法就是拿到data数据，然后进行判断，最后观测数据。

```js
function initData (vm: Component) {
  let data = vm.$options.data
  // 顺便把 data也放在 _data属性上
  data = vm._data = typeof data === 'function'
    ? getData(data, vm) // data.call(vm)
    : data || {}
    // 不是计划的对象 data不是对象 或者data函数返回值不是对象
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    // props中有该属性
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) { // 属性不要以 _ 和 $ 开头
        // 代理 vm._data
      // 访问 vm.name 代理到 vm._data.name
      proxy(vm, `_data`, key)
    }
  }
  // observe data 观测数据 标记整数根数据 new Vue
  observe(data, true /* asRootData */)
}
```

![image-20220419230737819](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220419230737819.png)

在observe方法中，就是创建Observer观测者

![image-20220419231313427](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220419231313427.png)

在这里就给引用类型创建观察者对象，如果该对象被观测过，直接返回观察过的observer对象.

观测的对象可能是数组，也可能是对象。

![image-20220419231506826](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220419231506826.png)

如果是一个对象（不是数组对象），就把对象的每个属性变成响应式的数据。那么此时就会来到定义响应式数据的核心方法：**defineReactive**

```js
walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      // 把对象的的每个 key 都变成响应式的
      defineReactive(obj, keys[i])
    }
  }
```

![image-20220419233003398](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220419233003398.png)

**defineReactive**方法，Vue是给我们导出了的，在Vue.utils下，有该工具函数。

虽然vue内部是基本是没有使用过shallow参数进行引用类型数据的浅层观测的，但是把方法暴露给我们用户了，我们使用的时候是可以浅层观测对象的。

![image-20220419234554437](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220419234554437.png)

可以自己尝试debugger看起响应式的过程。

![image-20220419233448785](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220419233448785.png)

![image-20220419234044426](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220419234044426.png)

### `Vue`中如何检测数组变化？

vue中检测数组的变化并没有使用defineProperty，因为修改索引的情况不多（且直接使用defineProperty会浪费大量性能，如果数组一万项，我们需要拦截一万次？）所以在vue中是重写数组的变异方法来实现的响应式（函数劫持）

流程：

1. _init -> initState -> initData -> observe -> defineProperty -> new Observer -> 发现value是数组
2. 对传入的数组进行原型链修改，后续调用的7个数组变异方法可以达到响应式变化
3. 但是，修改数组索引，修改长度是无法观测到的（不会响应式触发更新）
4. 此外，对于数组元素还是数组或者对象的，会再次观测的

![image-20220420102131534](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420102131534.png)

源码和第一个问题所在的源码位置是一样的，只是针对数组做了特殊处理。

### `Vue`中如何进行依赖收集？

- 所谓的依赖收集（观察者模式），被观察者指代的数据（dep收集watcher），观察者有三种（watcher）：
  - 渲染watcher
  - 计算属性watcher
  - 用户watcher

- 一个watcher可能对应着多个数据，所以watcher也需要保存dep

- 重新渲染的时候，可以让属性重新记录watcher，
- 计算属性也会用到
- 一个dep对应多个watcher（一个属性可以用在多个组件上）
- 一个watcher可以有多个dep（一个组件可以使用多个数据）
- 默认渲染的时候，会进行依赖收集

模板取值就会来到getter方法：

![image-20220420144922254](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420144922254.png)

![image-20220420152620191](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420152620191.png)

来到getter，表示当前watcher用到了此属性，那么属性的dep就会提醒watcher去收集此属性对应的dep，然后收集完毕后又让dep把watcher也收集了。当然在收集过程中做过去重操作。

在把依赖都收集完毕后，render函数也执行完毕了。此时清除无效的dep和watcher之间的关系。如果上次的dep在本次调用render函数时，并没有用到该属性的dep，那么就会把watcher和dep之前的关系清理掉。

### 如何理解`vue`中模板编译原理

我们用户传递的是template属性，我们需要把这个template编译成render函数。

- template -> ast语法树
- 对语法树进行标记（可以理解为优化，有些静态节点压根没有用到data数据，也就是节点本身是不会发生改变的）。递归标记，深度优先，先标记子节点，然后标记父节点。子节点不是静态节点，那么父节点很明显也不是静态的。最后还会标记一次当前节点的根节点是否是静态的。
- 将ast语法树生成render函数

最终每次渲染可以调用render函数返回对应的虚拟节点。

![image-20220420162606155](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420162606155.png)

![image-20220420165741462](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420165741462.png)

### `Vue`生命周期钩子是如何实现的

就是内部利用了一个发布订阅模式，将用户写的钩子维护成一个数组，后续在特殊时间点，一次调用callHook。

- 在调用_init方法中，会合并选项，使用的就是mergeOptions方法

![image-20220420172504196](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420172504196.png)

- 在该方法内进行父和子选项的属性合并

![image-20220420172730462](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420172730462.png)

- 对于有的策略，我们会使用对应的策略方式进行合并，策略模式在这里可以减少if-else的使用。

![image-20220420173025571](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420173025571.png)

- 钩子合并完成后，会在特殊的时间段调用，调用时使用的就是callHook方法.

![image-20220420173335594](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420173335594.png)

- callHook函数就是取出该生命周期的函数，依次执行，但是实际执行钩子的方法是`invokeWithErrorHandling`：该方法会捕获执行时的异常，也会绑定上下文，也可以在promise的情况下把错误给用户，不是promise的情况，会调用handleError方法帮助处理异常。

![image-20220420174011597](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420174011597.png)

- 此外，对于异常的捕获，也是有生命周期钩子的。在生命周期钩子执行报错后，默认执行此方法

![image-20220420174307513](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420174307513.png)

**内部实现原理就是发布订阅模式。主要就是靠mergeOptions方法**

生命周期合并后，会在特殊时间点调用。比如状态state初始化前后就会调用 **beforeCreate**和**created**两个钩子

![image-20220420175306965](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420175306965.png)

问题来了，为什么有些钩子是先执行子的，在执行父的钩子；但是有些又是先父后子？还有组件渲染是如何渲染的？

- 在组件渲染过程中，遇到父组件就渲染父组件，遇到子组件就渲染子组件。

```html
<!--渲染父-->
<div id="app">
    <!--开始渲染子-->
    <my-btn/>
    <!--子渲染完毕-->
    <!--继续渲染父-->
</div>
<!--渲染完毕-->
```

![image-20220420180410263](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420180410263.png)

![image-20220420180644701](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420180644701.png)

对于有些生命周期，肯定需要先执行父组件的，才能执行子组件的，比如created；但是像mounted等生命周期，肯定是先把子组件渲染出来，才能继续渲染父组件，因此肯定是先需要执行子组件的mounted等生命周期钩子。

![image-20220420194309178](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420194309178.png)

### 生命周期的价值

#### `Vue`的生命周期方法有哪些？一般在哪一步发送请求及其原因

1. beforeCreate：这里还没有实现响应式数据。该生命周期是在initState方法之前执行的。其实没什么特别大的用。（Vue3中已经用不到这玩意了）

2. **created**：这里已经进行了数据劫持，可以拿到响应式数据（不涉及dom渲染）。这个api可以在服务端渲染中使用。（vue3的setup取代了该钩子）

   ```js
   // init.js
   // 初始化生命周期 组件父子关系 $parent $children 等
   initLifecycle(vm)
   // 初始化事件 $on $emit $once $off ...
   initEvents(vm)
   // 声明变量 slot等
   initRender(vm)
   callHook(vm, 'beforeCreate')
   //  inject
   initInjections(vm) // resolve injections before data/props
   // TODO init data method computed ...
   initState(vm)
   // provide
   initProvide(vm) // resolve provide after data/props
   callHook(vm, 'created')
   ```

   ![image-20220420203718267](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420203718267.png)

3. beforeMount：没有实际的价值

   ![image-20220420203836748](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420203836748.png)

4. **mounted**：组件已经挂载完毕，第一次渲染完毕。在这个钩子中可以获取真实dom（$el）。**要明确一下，不一定mounted执行了，就代表组件全都挂载到页面上了，可能是子组件渲染完毕，挂载到父组件上，此时父组件不一定也渲染完毕了。只是代表我们在这个钩子中可以拿到当前组件对应的dom元素而已。**

   ![image-20220420210322716](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420210322716.png)

5. beforeUpdate：页面更新会调用该钩子

   ![image-20220420204700655](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420204700655.png)

6. updated：组件更新后调用。依赖更新导致视图刷新（非同步）

   ![image-20220420212306248](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420212306248.png)

7. activated：组件正在激活(未激活->激活)会被调用

   ![image-20220420211637051](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420211637051.png)

8. deactivated

   ![image-20220420215523293](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420215523293.png)

9. **beforeDestory**：手动调用移除后会触发。此时我们的watcher还在，还有响应式数据。（属性，方法等都还在）

10. **destoryed**：销毁组件后触发。所有属性和方法均已经被移除后触发。**所以对于不涉及组件数据/方法的清理工作，这两个钩子都可以。**

    ![image-20220420221058028](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220420221058028.png)

11. errorCaptured：捕获错误

**那我们应该在哪个钩子发起请求？**

一般最多的是在mounted中。（created不是比mounted早吗？要明确一下，代码是同步执行的，请求是异步的，就算请求的发出去的早这么一点点，也是等待同步代码执行完毕才能执行异步代码）

虽然服务端渲染都是在created中发起请求获取数据，但是即使是服务端渲染，也很少使用这个钩子。服务端没有dom，也没用mounted钩子。

在哪里发请求，主要看你要做什么事情，什么需求。（请求后获取最新dom做一些事情，就在mounted中）

有人说：created执行完再执行mounted，这个时候异步的created已经执行完了。

这种说法是错误的，因为生命周期是顺序调用的（同步执行），请求是异步的，所以最终获取到数据肯定是在mounted之后的。

**另外，我们说的created中拿不到dom，（因为此时还没开始解析模板，生成render，然后执行render函数生成虚拟dom，最后渲染成真实dom。）不能拿dom只是代表不能同步拿dom，但是如果你在created中发起了异步请求，在异步请求中的代码（比如请求成功的回调函数）是可以拿到dom元素了。vm.$el**

### 7. `Vue.mixin`的使用场景和原理

mixin我们用的比较多的就是混入生命周期。

通过Vue.mixin来实现逻辑的复用：

```js
Vue.mixin({
    beforeCreate(){
        // 每个vue组件实例都有该属性了
        this.$store = new Store()
        // 还可以扩展公共逻辑 比如每个组件销毁时都需要做的某些事情...
    }
})
```

虽然mixin可以实现逻辑的复用，数据的混入复用等等。但是问题在于数据来源不明确。我们在组件中使用某个数据或者某个方法，我们有时候是不知道这个方法或者数据是来自哪里的？父组件传值？还是说provide？...会造成混乱。有时候难以定位错误。

```js
Vue.mixin({
    data(){
        return {
            name:"张三"
        }
    }
})
Vue.component("my-btn",{
    template:`<div>{{name}}</div>`
})
```

而且对于多个数据，如果组件自己内部定义了和mixin混入的同名属性，可能会导致命名冲突问题。（虽然在组件实例化的过程，mixin的选项和组件自身的选项合并时(mergeOptions方法中)是以用户选项为主）

![image-20220421205535716](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220421205535716.png)

![image-20220421205648412](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220421205648412.png)

mixin的核心就是合并属性，内部采用了策略模式进行合并。使用方式就是全局和局部的mixin。

当然针对不同的属性有不同的合并策略。此外：出现命名冲突也是不会报错和提示的

```js
// mixin方法 Vue.mixin
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    // 谁调用 this就是谁 最终会将 mixin选项和Vue.options合并在一起
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
```

![image-20220421211536548](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220421211536548.png)

### 8. `Vue`组件data为什么必须是个函数？

在声明一个组件的时候，其实你data属性不是一个函数，也能正常运行，只是控制台会提醒你，让你把data属性给成函数。

![image-20220421213434183](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220421213434183.png)

我们知道，我们使用Vue.component定义一个组件的时候，内部实际调用的是Vue.extend方法（我在mini-vue中写过的）。

传送门：[mini-vue](https://blog.csdn.net/weixin_45747310/article/details/124248434?spm=1001.2014.3001.5501)

**原因：**针对根实例来说（new Vue），一般我们一个项目都是一个根，所以data可以是对象。但是对于组件来说，组件是通过同一个构造函数多次创建实例，如果是同一个对象，所以实例共享一份data，实例的data之间会相互影响。每个组件的数据源应该都是独立的。那就每次都调用data，返回一个独立的数据。

![image-20220421222506169](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220421222506169.png)

![image-20220421222547836](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220421222547836.png)

在组件实例化的时候：我们会根据data是否是函数，来进行data函数的执行的。（_init -> initState -> initData）

![image-20220421222744642](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220421222744642.png)

### 9. `nextTick`在哪里使用？使用原理？

**nextTick内部采用了异步任务进行了包装**（多个nextTick调用，会被合并成一次，内部会合并回调），最后在异步任务中批处理。

主要应用场景就是异步更新（默认调度的时候，就会添加一个nextTick任务），用户为了获取最终的渲染结果，需要在内部任务执行完成以后去执行用户逻辑。这时候用户需要把对应的逻辑放到nextTick中。

![image-20220422102017271](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220422102017271.png)

### 10. `computed`和`watch`的区别

computed和watch的相同点：

- 底层都是创建了watcher（computed定义的属性可以在模板中使用，但是watch不能在视图中使用）

- computed默认不会立即执行，只有取值的时候才会执行。内部会维护一个dirty属性，来控制依赖的值是否发生改变。（默认情况下，计算属性需要同步返回结果，有个包可以把computed变成异步的）

  ![image-20220422115230809](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220422115230809.png)

- watch默认用户会提供一个回调函数，数据变化了就调用这个回调。我们可以监控某个数据的变化，数据变化了就执行某些操作

![image-20220422113320892](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220422113320892.png)

![image-20220422114228105](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220422114228105.png)

### 11. `Vue.set`方法是如何实现的

Vue只会在定义在data中的数据进行劫持。对于Vue.set方法，我们可以认为这是vue的补丁方法（在创建好实例以后，通过实例进行属性的添加，vue是不会劫持的，不会触发更新视图的操作）

而且，我们数组也无法监控索引和长度，所以我们就想到一个方法，手动触发更新。

如何实现的？

我们给每一个对象都增添一个dep属性(一个属性对应一个dep)，在给对象新增属性，或者修改数组索引对应的元素时，手动触发更新。

```js
const vm =  new Vue({
    data(){
        return {
            firend:{
                name:"张三"
            }
        }
    }
})
vm.firend.age = 22
vm.firend.__ob__.dep.notify() // 手动通知更新
```

set方法的实现原理就是如此。

![image-20220422155459024](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220422155459024.png)

```js
export function set (target: Array<any> | Object, key: any, val: any): any {
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
```

### 12. `Vue`为什么需要虚拟dom

虚拟dom的好处是什么？

- 我们写的代码可能要针对不同的平台来使用（weex，web，小程序），虚拟dom的最大好处就是跨平台，不需要考虑跨平台问题。
- 不用关心兼容性问题，可以在上层对应的渲染方法传进来，再通过虚拟dom进行渲染即可。

- 针对更新的时候，用到了diff算法，有了虚拟dom之后，我们就可以通过diff算法来找到最后的差异进行修改真实dom。

### 13. `Vue`中`diff`算法原理

diff算法的特点就是平级比较，内部采用了双指针方式进行了优化，优化了常见操作。

采用了递归比较的方式。

**针对一个节点的diff算法**

- 先拿出更节点进行比较，如果是同一个节点，则比较熟悉，如果不是同一个节点则直接换成最新的即可。
- 同一个节点比较熟悉后，复用老节点

**比较子节点**

- 一方有儿子，一方没儿子。（无非就是移出节点，新增节点）
- 两方都有儿子时，一层层比较
  - 优化比较的方式：
    1. 先比较两方的头结点，不相同
    2. 在比较两方的尾节点，不相同
    3. 开始进行交叉比较，一方的头和另一方的尾进行比较（有两次比较）
    4. 在上面比较都失败的情况下，就是乱序比较了
  - 对于乱序比较，就是维护了一个老虚拟节点子节点的映射表，用新的节点去映射表中去查找此元素是否存在，存在就进行移动，不存在就插入新的节点，最后删除多余的老节点

**缺点：**比较时可能出现多出无谓的移动节点情况。

![image-20220422162934031](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220422162934031.png)

vue在进行diff比较的时候，发现AB节点是需要删除的节点，CD节点命中，可以复用，所以会把CD节点移动到头指针的最前方，然后把FG节点插入，E节点也删除。很明显，CD节点是不需要移动的，我们只是需要把ABE节点删除，然后把FG节点插入到CD节点之间即可。因为CD节点的相对顺序没有发生改变。

![image-20220422163153878](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220422163153878.png)

![image-20220422191442012](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220422191442012.png)

![image-20220422191407849](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220422191407849.png)

![image-20220422191637952](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220422191637952.png)

![image-20220422191642145](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220422191642145.png)

![image-20220422191645840](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220422191645840.png)

![image-20220422191721024](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220422191721024.png)

### 14. 既然`Vue`通过数据劫持可以精准探测数据变化，为什么还需要虚拟dom进行`diff`检测差异

我们根据响应式，的确是可以知道哪里出现了更新。如果让一个变量，一个属性就对应一个watcher，粒度太小，watcher这玩意是比较消耗内存的。

- 如果给每个属性，都去增加watcher，当然也是可以实现响应式更新视图。但是可能在变量age发生改变的时候，触发了name的改变，那么视图又会更新。粒度太小导致也不好控制。
- 降低watcher的数量，让每个组件有一个watcher，某个属性变化了，我们会把整个组件都更新了，那么这个组件内即使依赖了其他的变量，也会在视图上更新最新值。
- 如果不用diff算法，我们需要对每个标签，属性等都比较一次，太暴力，反而性能更低。出现虚拟dom就是为了提高性能的。
- 通过diff算法和响应式原理折中处理了一下。
- 在vue1.x中，就是给每个属性都增加了一个watcher，导致的情况就是页面一大了就容易卡，刷新很慢等情况。

### 15. 请说明`Vue`中key的作用和其原理，谈谈你对它的理解

isSameVNode方法中，会根据key来判断两个元素是否是同一个元素，key不相同说明不是同一个元素（key在动态列表中，不要使用index）。

我们使用key，要尽量保证key的唯一性。这样可以优化diff算法。

### 16. 谈谈对`Vue`组件化的理解

组件的优点：

1. 组件的复用可以根据数据渲染对应的组件。
2. 把组件相关的内容放在一起，方便复用，方便维护。
3. 合理的规划组件，可以做到更新视图的时候是组件级别的更新，不会过于消耗性能。

**vue中是如何处理组件的？**

1. 需要使用API，`Vue.extend`。根据用户传入的对象生成一个组件的构造函数。
2. 根据组件产生对应的虚拟节点。我们会在生成虚拟节点前，在组件的data中加入一个hook。(data:{hook:{init(){}}})
3. 做组件初始化，将虚拟节点转换为真实节点（组件的init方法，就是第二步中增加的）。就是调用init方法（init方法中就是 new Sub().$mount()）

当然这个题也是需要结合17题来走一遍流程的。

### 17. `Vue`组件的渲染流程

- 先定义组件的选项
- components -> vm.$options.components[“name”] = {name:{template:””}}
- createComponent：（这个函数是创建vnode的，并插入相关的hook，如init） 渲染组件name的时候，需要创建name对应的虚拟节点
- createComponent创建真实节点 -> vm.data.hook.init() -> new Ctor().$mount() -> 组件的初始化完毕

![image-20220424133849698](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220424133849698.png)

**patch** 方法，就是我们的`vm.__patch__`方法

![image-20220424134100065](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220424134100065.png)

![image-20220424134134553](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220424134134553.png)

![image-20220424134309114](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220424134309114.png)

![image-20220424134356984](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220424134356984.png)

![image-20220424134549820](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220424134549820.png)

![image-20220424134619312](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220424134619312.png)

![image-20220424134646485](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220424134646485.png)

### 18. `vue`组件的更新流程

同上一题分析。

组件更新的有几种情况：

1. data数据更新，就是依赖收集
2. 属性更新，可以给组件传入属性，属性变化后，触发更新
3. 插槽变化也要更新

属性props的变化，触发更新，肯定也是来到patch方法。

- 组件更新会触发组件的prepatch方法，会复用组件，并且比较组件的属性，事件，插槽等
- 父组件给子组件传递的属性（props）是响应式的，在模板中使用会做依赖收集，收集自己的组件watcher
- 稍后组件更新了，会重新给props赋值，赋值完成后会触发watcher重新更新

### 19. `vue`中异步组件原理

Vue中异步组件的写法有很多。主要用作大的组件进行异步加载。比如markdown组件，editor组件。

先渲染一个注释标签，等组件加载完毕后，在重新渲染。

- forceUpdate（类似于图片懒加载），使用异步组件会配合webpack

- 原理就是，异步组件默认不会调用Vue.extend方法，所以Ctor（函数）上不会cid属性，没有cid我们就认为是异步组件了。

![image-20220428130555925](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220428130555925.png)

- 会先渲染一个占位组件，有loading就会先渲染loading，此时第一轮结束
- 如果用户调用了resolve，会将结果赋给factory.resolved上，强制重新渲染。重新渲染的时候，会再次进入到resolveAsyncComponnet中，会直接拿到factory.resolved的结果来渲染。

![image-20220428154954662](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220428154954662.png)

![image-20220428155107000](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220428155107000.png)

![image-20220428155225772](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220428155225772.png)

### 20. 函数式组件的优势及其原理

- react中也有两种组件：类组件和函数式组件
- 函数式组件，没有类就没有this，也就没有状态这些，没有生命周期 beforeCreate等。
- 函数式组件的好处：就是性能好，不需要创建watcher等
- 函数式组件就是调用render，拿到返回结果（vnode）所以性能高

![image-20220428161544682](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220428161544682.png)

### 21. `vue`组件间传值的方式及之间的区别

1. props：父传递数据给儿子
2. emit ：儿子触发组件更新

**先看props**

```html
  <div id="app">
    <my a="123" c="我是父给子的数据" />
  </div>
  <script src="../dist/vue.js"></script>
  <script>
    const vm = new Vue({
      data() {
        return {
        }
      },
      el: "#app",
      components: {
        "my": {
          props: ["c"],
          // a是普通属性 attrs c是props属性 props->c  attrs->a
          /*
          组件的虚拟节点上 {componentOptions: propsData} propsData -> c
          初始化的时候要对propsData做处理
          将组件的属性挂载到vm.$options.propsData
          声明一个 vm._props 类似于 vm._data
          只有根属性会被观测，其他父组件传递给我们的不需要进行观测
          将所有的属性定义到 vm._props上
          vm.c -> vm._props.c
          */
          template: `<h2 :c="c">我是组件</h2>`
        }
      }
    })
  </script>
```

首先要搞明白，我们父组件传递给子组件的数据，最开始全都是attrs，也就是属性。但是，我们在创建组件的虚拟dom的时候，会把属性进行抽离：如果我们在props中定义了该属性，表名这个属性是父组件传递的props属性，如果没有定义，该属性概述作为attrs属性。

![image-20220430214149996](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220430214149996.png)

![image-20220430221724530](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220430221724530.png)

更新组件的时候，我们会走updateComponentChildren方法

![image-20220430231527888](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220430231527888.png)

总结一下：props的原理就是把解析后的props，验证后将属性定义在当前实例上的`vm._props`.这个对象上的属性都是通过 `defineReactive`方法来定义的。都是响应式的。组件在渲染的过程中，会去vm上的`_props`取值，（_props属性也会被代理到vm上）

**emit方式：**

![image-20220430233500966](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220430233500966.png)

使用emit进行组件通信，那么用到的就是发布订阅模式。

```js
my.$on("cb",cb)
```

在创建虚拟节点的时候将所有事件，绑定到了listeners，如果是有修饰符`.native`修饰的事件，会绑定在组件上，最后在nativeOn属性上。在ininEvents方法内，将事件通过add（其实就是$on）方法绑定事件，通过$emit触发事件。

![image-20220501102707287](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220501102707287.png)

**eventBus**原理就是发布订阅， `$bus = new Vue()`简单的通信可以采用这种方式，但是对于多个组件之间相互通信，会显得有些混乱。

对于 **$parent,$children**，就是在创造子组件的时候，会将父组件的实例传入，在组件本身初始化的时候会构建组件间的父子关系，$parent获取父组件实例，通过$children获取所有的子组件实例。开发中也不建议使用。（$parent.$parent... 岂不是回到了jquery）

![image-20220501103103930](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220501103103930.png)

**ref**原理：

- ref可以获取dom元素和组件的实例，（虚拟dom没有处理ref，这里无法拿到实例，也无法获取组件）
- 创建dom的时候是如何处理ref的
- 会将用户所有的dom操作及属性，都维护到一个cbs属性中，（create，update，insert，destory....）依次调用cbs中的create方法，这里就包含ref相关的操作，会操作ref，并且赋值。

![image-20220501130014260](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220501130014260.png)

**inject，provide**

在父组件通将属性暴露出来，在后代属组件中注入属性。（**少用**）

父级组件提供的数据，在子组件中递归查找，找到就定义在自己的身上。

![image-20220501131318169](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220501131318169.png)

**$attrs, $listeners**

- $attrs：所有组件上的属性，不涵盖props
- $listeners：组件上所有的事件

![image-20220501132237053](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220501132237053.png)

通过$attrs属性，可以快速的把非props的属性传递给子组件

![image-20220501133453020](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220501133453020.png)

![image-20220501133506770](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220501133506770.png)

**其实**还有一个Vue.observal，可以创造一个全局的对象用于通信

### 22. `v-if`和`v-for`那个优先级高

先说结论：`v-for`的优先级比`v-if`高。

在编译的时候，会将v-for渲染成_l函数，v-if会变成三元表达式。

注意：实际开发时，在一个标签上，不要同时使用v-for和v-if，二者不要连着用。

![image-20220501164905895](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220501164905895.png)

![image-20220501164949473](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220501164949473.png)

**v-if和v-show的区别：**

- v-show：是控制样式，通过`display:none`控制元素的显示和隐藏。
- v-if：控制是否渲染dom

为什么v-show控制样式，是通过display来进行控制元素的显示和隐藏的？而不是选择通过透明度opacity或者visibility？

**v-if编译的时候会变成三元表达式，但是v-show会编译为一个指令**

之所以不采用visibility:hidden，因为这样做了该元素仍然会占位，只是不可见（也不会响应事件了）;而透明度opacity在为0的情况下，也不可见，但是也仍然占位，且会响应事件

![image-20220501170915501](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220501170915501.png)

### 23. `v-if`,`v-model`,`v-for`的实现原理是什么

**v-if已经说没了。**

**v-for**：还是一样，会被渲染为 _l函数

![image-20220501172516729](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220501172516729.png)

#### v-model

v-model实现双向数据绑定。放在表单元素上可以实现双向数据绑定，放在组件上不一样。

- v-model放在不同的元素上，会编译出不同的结果：针对文本来说就会处理文本（会被编译成value+input+指令处理）
- value和input实现双向数据绑定，阻止中文的触发，指令作用就是处理中文输入完毕后，手动触发更新。

v-model绑定到组件上，这里会编译成一个model对象，组件在创建虚拟节点的时候，会利用这个对象，会看一下里面是否有自定义的prop和event，如果没有则会被解析为value+input的语法糖

### 24. `Vue`中的`slot`是如何实现的？什么时候使用它？

- 普通（默认）插槽：
  - 普通插槽渲染作用域是在父组件中完成的
  - 在解析组件的时候会将组件的children放到componentOptions的children上，作为虚拟节点的属性
  - 将children取出放到组件的 vm.$options._renderChildren中
  - 做出一个映射表，放到vm.$slots上，将结果放到vm.$scopedSlots上
  - `vm.$scopedSlots: {a:fn,b:fn,default:fn}`4
  - 渲染组件的时候，会调用 _t方法，此时会去vm.$scopedSlots找到对应的函数来渲染内容
- 具名插槽：
  - 多增加了一个name，也就是名字
- 作用域插槽：
  - 作用域是在子组件中。作用域插槽渲染的时候不会作为children，将作用域插槽做成了一个属性scopedSlots
  - 制作一个映射关系 $scopedSlots = {default “”: fn:function(){}}
  - 稍后在渲染组件的模板的时候，会通过name找到对应的函数，将数据传入到函数中，此时才渲染虚拟节点，用这个虚拟节点替换 _t函数

组件的孩子j叫插槽，元素的孩子还是孩子。

- 创建组件的真实节点`this.$slots = {default:[儿子vnode]}`

### 25. `Vue.use`是干什么的？原理是什么？

用来实现插件的。参数一般是一个函数，函数接收Vue的构造函数和额外的选项。

```js
function plugin(Vue,options){}

Vue.use(plugin)
```

![image-20220502182659504](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220502182659504.png)

使用Vue的use函数，是专门用来注册插件的。可以防止Vue的版本不统一。也不会让Vue-router，vuex等插件直接依赖于vue，我们只需要在使用这些插件的时候注册插件就可以了。

使用vue函数的目的，就是将vue构造函数传递给插件，让所有的插件依赖的vue是同一个版本。该发方法的源码本身并不难。

例如vue-router和vuex等插件，都没有依赖vue，在项目的package-json文件里面也没依赖vue，是通过参数形式传入的。

插件并不会进行重复安装的。

### 26. `Vue`事件修饰符有哪些？及其实现原理是什么？

实现原理只要是靠的是模板编译原理。.stop .prevent等修饰符是直接编译到事件内部了。

对于.passive, capture, .once在编译的时候增加标识 `! ~ &`

键盘事件，也是通过模板编译来实现的。

### 27. `Vue`中的 `.sync` 修饰符的作用，用法及其实现原理

- 和v-model一样，这个api是为了实现状态同步的。这个东西在vue3中移除了。

没什么意思，有需要的查文档。

### 28. 如何理解自定义指令

自定义指令，就是用户定义好对应的钩子，当元素在不同的状态时，会调用对应的钩子。所有的钩子会被合并到cbs对应的方法上，到时候会被依次调用

![image-20220503132159508](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220503132159508.png)

### 29. `keep-alive`平时在哪里使用？原理是什么

1. 在路由中使用
2. 在`component:is`中使用

keep-alive的原理是默认缓存加载过的组件对应的实例，内部采用了LRU算法。下次组件切换加载的时候，此时会找到对应缓存的虚拟节点来进行初始化（走了初始化，但是没有进行真正的初始化，init -> prepatch），但是会采用上次缓存的实例上的$el来触发。

更新和销毁会触发actived和deactived的钩子

```js
export default {
  name: 'keep-alive',
  // 抽象组件 不会被记录到 $children 和 $parent上
  abstract: true,

  props: {// 属性
    // 可以缓存那些组件
    include: patternTypes,
    // 可以排除那些组件
    exclude: patternTypes,
    // 最大缓存个数
    max: [String, Number]
  },

  methods: {
    cacheVNode() {
      const { cache, keys, vnodeToCache, keyToCache } = this
      if (vnodeToCache) {
        const { tag, componentInstance, componentOptions } = vnodeToCache
        cache[keyToCache] = {
          // 缓存中 放置需要缓存的组件 存放组件的实例
          name: getComponentName(componentOptions),
          tag,
          componentInstance, // 组件实例渲染后 会有 $el属性 下次直接复用 $el
        }
        keys.push(keyToCache) // 放入key
        // prune oldest entry
        // 超过最大长度 会移除最长时间未使用的缓存
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
        this.vnodeToCache = null
      }
    }
  },

  created () {
    // 创建一个缓存区 {}
    this.cache = Object.create(null)
    // 缓存组件的名字有哪些 []
    this.keys = []
  },

  destroyed () {
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  mounted () {
    // 渲染完成后 缓存vnode
    this.cacheVNode()
    this.$watch('include', val => {
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },

  updated () {
    this.cacheVNode()
  },

  render () {
    // 取出默认插槽
    const slot = this.$slots.default
    // 获取插槽中的第一个vnode
    const vnode: VNode = getFirstComponentChild(slot)
    // 拿到第一个插槽上的组件的额外选项 {Ctor, propsData, listeners, tag, children }
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern 获取组件的名字 看组件是否加载过
      const name: ?string = getComponentName(componentOptions)
      // 校验是否需要缓存
      const { include, exclude } = this
      if ( // 这些情况不需要复用
        // not included 不需要缓存
        (include && (!name || !matches(include, name))) ||
        // excluded 排除的
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }
      // 缓存对象 {} []
      const { cache, keys } = this
      // 生成一个唯一的 key
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      if (cache[key]) { // key缓存过
        // 获取缓存的实例
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        remove(keys, key) // 把当前的key作为最新的
        keys.push(key)
      } else {
        // delay setting the cache until update
        // 以前没有缓存过 将当前的vnode进行缓存 缓存key
        this.vnodeToCache = vnode
        this.keyToCache = key
      }
      // 给虚拟节点增加标识 data: keepAlive:true
      vnode.data.keepAlive = true
    }
    // vnode上有 data.keepAlive 和 componentInstance 说明vnode缓存过
    return vnode || (slot && slot[0]) // 返回vnode
  }
}
```

### 30. 组件中写`name`选项有哪些好处及作用？

在vue中有name属性的组件可以被递归调用。（这里可以被类比我们的匿名函数具名化）

在声明组件的时候，`Sub.options[name] = 组件`

![image-20220502184432294](https://gitee.com/maolovecoding/picture/raw/master/images/web/webpack/image-20220502184432294.png)

- 我们用来标识组件，通过name可以找到该组件。也可以自己封装跨级通信
- name属性还能用作devtool调试工具，来标明具体的组件。

**主要用作组件递归和起到标识作用**
