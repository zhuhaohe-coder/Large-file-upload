import Vue from 'vue'
import App from './App.vue'
import { Upload, Icon, Spin, Button } from 'iview';
import 'iview/dist/styles/iview.css';

Vue.component('IViewUpload', Upload);
Vue.component('IViewIcon', Icon);
Vue.component('IViewSpin', Spin);
Vue.component('IViewButton', Button);

Vue.config.productionTip = false

new Vue({
  render: h => h(App),
}).$mount('#app')
