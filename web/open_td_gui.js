import { SimpleGridLayoutManager } from "./gui.js";
;
export class StateManagedUI {
    constructor(state) {
        this.state = state;
    }
    draw(ctx, canvas, x, y, width, height) {
        this.state.draw(ctx, canvas, x, y, width, height);
    }
    handleKeyboardEvents(type, event) {
        this.state.handleKeyboardEvents(type, event);
    }
    handleTouchEvents(type, event) {
        this.state.handleTouchEvents(type, event);
    }
    transition(delta_time) {
        this.state = this.state.transition(delta_time);
    }
}
;
export class StateManagedUIElement {
    constructor() {
        this.layouts = [];
    }
    draw(ctx, canvas, x, y, width, height) {
        this.layouts.forEach(layout => layout.draw(ctx));
    }
    handleKeyboardEvents(type, event) {
        this.layouts.forEach(layout => layout.handleKeyBoardEvents(type, event));
    }
    handleTouchEvents(type, event) {
        this.layouts.forEach(layout => layout.handleTouchEvents(type, event));
    }
    transition(delta_time) {
        throw new Error("Method not implemented.");
    }
}
//always show
const hud = new SimpleGridLayoutManager([0, 0], [0, 0], 0, 0);
//ui group 0
const tower_selector = new SimpleGridLayoutManager([0, 0], [0, 0], 0, 0);
const path_piece_selector = new SimpleGridLayoutManager([0, 0], [0, 0], 0, 0);
//state managed ui group 1
//Nothing transitions self, TowerUpdrageUI, Victory, Loss
//state TowerUpgradeUI transitions self, Nothing, Victory, Loss
const tower_updater_right = new SimpleGridLayoutManager([0, 0], [0, 0], 0, 0);
const targeting_menu = new SimpleGridLayoutManager([0, 0], [0, 0], 0, 0);
//state Victory transitions self, Nothing
const victory_screen = new SimpleGridLayoutManager([0, 0], [0, 0], 0, 0);
//state Loss Transitions to self, Nothing
const loss_screen = new SimpleGridLayoutManager([0, 0], [0, 0], 0, 0);
export class PlacePathState extends StateManagedUIElement {
    constructor(game) {
        super();
        this.possible_change = false;
        this.game = game;
        this.layouts.push(hud);
        this.layouts.push(path_piece_selector);
    }
    handleTouchEvents(type, event) {
        super.handleTouchEvents(type, event);
        if (type === "touchend") {
            this.game.map.add_random_enemy();
            this.game.try_add_piece(event.touchPos[0], event.touchPos[1]);
        }
    }
    transition(delta_time) {
        if (this.game.keyboardHandler.keysHeld["KeyD"])
            return new DefaultGameState(this.game);
        return this;
    }
}
export class DefaultGameState extends StateManagedUIElement {
    constructor(game) {
        super();
        this.possible_change_to_place_pieces = false;
        this.game = game;
        this.layouts.push(hud);
        this.layouts.push(tower_selector);
    }
    handleTouchEvents(type, event) {
        super.handleTouchEvents(type, event);
        console.log(this.game.try_place_ballista(event.touchPos[0], event.touchPos[1]));
    }
    transition(delta_time) {
        if (this.game.keyboardHandler.keysHeld["KeyP"]) {
            return new PlacePathState(this.game);
        }
        else if (this.game.selected_tower) {
            return new TowerInfoState(this.game);
        }
        else if (this.game.has_won_level()) {
            return new VictoryState(this.game);
        }
        else if (this.game.has_lost_level()) {
            return new LossState(this.game);
        }
        return this;
    }
}
;
export class TowerInfoState extends DefaultGameState {
    constructor(game) {
        super(game);
        this.layouts.push(tower_updater_right);
        this.layouts.push(targeting_menu);
        const tower = game.selected_tower;
        tower_updater_right.x = game.transform_x_to_screen_space(tower.x + tower.width);
        tower_updater_right.y = game.transform_y_to_screen_space(tower.y);
        targeting_menu.x = game.transform_x_to_screen_space(tower.x - targeting_menu.width());
        targeting_menu.y = game.transform_y_to_screen_space(tower.y);
    }
    transition(delta_time) {
        const tower = this.game.selected_tower;
        if (tower) {
            tower_updater_right.x = this.game.transform_x_to_screen_space(tower.x + tower.width);
            tower_updater_right.y = this.game.transform_y_to_screen_space(tower.y);
            targeting_menu.x = this.game.transform_x_to_screen_space(tower.x - targeting_menu.width());
            targeting_menu.y = this.game.transform_y_to_screen_space(tower.y);
            return this;
        }
        else {
            return super.transition(delta_time);
        }
    }
}
export class VictoryState extends DefaultGameState {
    constructor(game) {
        super(game);
        this.layouts.push(victory_screen);
    }
}
export class LossState extends DefaultGameState {
    constructor(game) {
        super(game);
        this.layouts.push(loss_screen);
    }
}
