import { render } from 'preact';
import { App } from './ui/App';
import './styles.css';

const root = document.querySelector('#app');
if (root) render(<App />, root);
