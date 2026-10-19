import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import '../shared/styles/index.css'
import { installAuthFetch } from '../shared/services/authFetch'

installAuthFetch()   // adds the login token to every API request (see services/authFetch.js)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
