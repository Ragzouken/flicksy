import * as React from 'react';
import './App.css';

import { PixiComponent } from "./Pixi";

class App extends React.Component {
  public render() {
    return (
      <div className="App">
        <PixiComponent />
      </div>
    );
  }
}

export default App;
