import React from 'react';
import ReactDOM from 'react-dom';

import './index.css'

import App from './App';

import state from './state'

ReactDOM.render(<App data={state}/>, document.getElementById('root'));
