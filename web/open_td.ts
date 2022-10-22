import {SingleTouchListener, TouchMoveEvent, MouseDownTracker, isTouchSupported, KeyboardHandler} from './io.js'
import {RegularPolygon, getHeight, getWidth, RGB, Sprite, blendAlphaCopy} from './gui.js'
import {random, srand, max_32_bit_signed, FixedSizeQueue, Queue, PriorityQueue, DynamicInt32Array} from './utils.js'
import {non_elastic_no_angular_momentum_bounce_vector, get_normal_vector_aabb_rect_circle_collision, magnitude, dot_product_2d, scalar_product_2d, normalize2D, distance, GameObject, menu_font_size, SpatiallyMappableCircle, SpatialHashMap2D, SquareAABBCollidable, Circle, manhattan_distance } from './game_utils.js'

class Projectile extends SquareAABBCollidable {
    target:SquareAABBCollidable;
    origin:SquareAABBCollidable;
    bleed_damage:number;
    poison_damage:number;
    burn_damage:number;
    base_damage:number;


    constructor(x:number, y:number, width:number, height:number)
    {
        super(x, y, width, height);
        this.base_damage = 0; 
        this.bleed_damage = 0;
        this.poison_damage = 0;
        this.burn_damage = 0;
    }
    damage_enemy(enemy:Enemy):void
    {

    }
};
class Arrow extends Projectile {
    constructor(target:SquareAABBCollidable, origin:SquareAABBCollidable, x:number, y:number, width:number, height:number)
    {
        super(x, y, width, height);
        this.base_damage = 100; 
        this.bleed_damage = 150;
        this.poison_damage = 0;
        this.burn_damage = 0;
        this.target = target;
    }
    damage_enemy(enemy:Enemy):void
    {
        enemy.add_bleed(this.bleed_damage);
        enemy.lose_hp(this.base_damage);
    }
};
class Tower extends SquareAABBCollidable {
    constructor(x:number, y:number, dim:number)
    {
        super(x, y, dim, dim);
    }
};
class Ballista extends Tower {

}
class PieceChildren {
    left_child:PathPiece | null;
    right_child:PathPiece | null;
    bottom_child:PathPiece | null;
    top_child:PathPiece | null;
    constructor()
    {
        this.left_child = null;
        this.right_child = null;
        this.top_child = null;
        this.bottom_child = null;
    }
}
class PathPiece extends SquareAABBCollidable {
    path:Path | null;
    parent:PathPiece | null;
    children:PieceChildren;
    color:RGB;
    color_inner:RGB;
    polygon:RegularPolygon;
    left_initially_free:boolean;
    right_initially_free:boolean;
    top_initially_free:boolean;
    bottom_initially_free:boolean;
    
    constructor(x:number, y:number, width:number, height:number, path:Path | null, parent:PathPiece | null = null)
    {
        super(x, y, width, height);
        this.children = new PieceChildren();
        this.parent = parent;
        this.path = path;
        this.color = new RGB(0x0, 0xff, 0x0, 0xff);
        this.color_inner = new RGB(0x0, 0x0, 0xff, 0xff);
        this.polygon = new RegularPolygon(3, 3);
        this.left_initially_free = this.left_free();
        this.right_initially_free = this.right_free();
        this.top_initially_free = this.top_free();
        this.bottom_initially_free = this.bottom_free();
    }
    draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
        if(this.path)
        {
            this.polygon.sides = this.path.map.paths.indexOf(this.path) + 3;
            this.polygon.resize_radius(this.width / 2);
            ctx.fillStyle = this.color.htmlRBG();
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = "#000000";
            ctx.beginPath();
            if(!this.left_initially_free)
            {
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x, this.y + this.height);
            }
            if(!this.right_initially_free)
            {
                ctx.moveTo(this.x + this.width, this.y);
                ctx.lineTo(this.x + this.width, this.y + this.height);
            }
            if(!this.top_initially_free)
            {
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + this.width, this.y);
            }
            if(!this.bottom_initially_free)
            {
                ctx.moveTo(this.x, this.y + this.height);
                ctx.lineTo(this.x + this.width, this.y + this.height);
            }
            ctx.stroke();
        }
    }
    is_leaf():boolean
    {
        let is_leaf = false;
        if(this.path)
        {
            if(this.left_free() && !this.path!.map.check_collision_fast(
                new SquareAABBCollidable(this.x - this.width, this.y, this.width, this.height)))
                is_leaf = true;
            if(this.right_free() && !this.path!.map.check_collision_fast(
                new SquareAABBCollidable(this.x + this.width, this.y, this.width, this.height)))
                is_leaf = true;
            if(this.top_free() && !this.path!.map.check_collision_fast(
                new SquareAABBCollidable(this.x, this.y - this.height, this.width, this.height)))
                is_leaf = true;
            if(this.bottom_free() && !this.path!.map.check_collision_fast(
                new SquareAABBCollidable(this.x, this.y + this.height, this.width, this.height)))
                is_leaf = true;
        }
        return is_leaf;
    }
    left_free():boolean
    {
        return !this.children.left_child;
    }
    right_free():boolean
    {
        return !this.children.right_child;
    }
    top_free():boolean
    {
        return !this.children.top_child;
    }
    bottom_free():boolean
    {
        return !this.children.bottom_child;
    }
    position_open(pos:SquareAABBCollidable):string | null
    {

        if(pos.x <= this.mid_x() && pos.y >= this.y && this.y + this.height >= pos.y)//left
        { 
            if(this.left_free())
            {
                return "left_child";
            }
        }
        else if(pos.x >= this.mid_x() && pos.y >= this.y && this.y + this.height >= pos.y)//right
        {
            if(this.right_free())
            {
                return "right_child";
            }
        }
        else if(pos.y <= this.mid_y() && pos.x >= this.x && this.x + this.width >= pos.x)//top
        {
            if(this.top_free())
            {
                return "top_child";
            }
        }
        else if(pos.y >= this.mid_y() && pos.x >= this.x && this.x + this.width >= pos.x)//bottom
        {
            if(this.bottom_free())
            {
                return "bottom_child";
            }
        }
        return null;
    }
    child_bounding_box(child:string):SquareAABBCollidable
    {
        if(child === "left_child")
        {
            return new SquareAABBCollidable(this.x - this.width, this.y, this.width, this.height);
        }
        else if(child === "right_child")
        {
            return new SquareAABBCollidable(this.x + this.width, this.y, this.width, this.height);
        }
        else if(child === "top_child")
        {
            return new SquareAABBCollidable(this.x, this.y - this.height, this.width, this.height);
        }
        else if(child === "bottom_child")
        {
            return new SquareAABBCollidable(this.x, this.y + this.height, this.width, this.height);
        }
        else 
            throw "error invalid child: "+child;
    }
    try_add_random():void
    {
        const possible_sides = <any[]>[];
        for(const key in this.children)
        {
            if(this.children[key] === null && this.path && !this.path.map.check_collision_fast(this.child_bounding_box(key)))
            {
                possible_sides.push(key);
            }
        }
        const key = possible_sides[Math.floor(random() * possible_sides.length)];
        
        if(key)
        {
            if(key === "left_child")
            {
                console.log(this.children[key], key)
                const types = this.path!.map.piece_types.filter(
                    (value, index, arr) => this.path!.map.piece_type_instances[index].right_initially_free);
                const type = types[Math.floor(random() * types.length)];
                if(type)
                {
                    this.children[key] = new type(this.x - this.width, this.y, this.width, this.height, this.path, this);
                }
            }
            else if(key === "right_child")
            {
                const types = this.path!.map.piece_types.filter(
                    (value, index, arr) => this.path!.map.piece_type_instances[index].left_initially_free)

                const type = types[Math.floor(random() * types.length)];
                if(type)
                {
                    this.children[key] = new type(this.x + this.width, this.y, this.width, this.height, this.path, this);
                    console.log(this.children[key].left_free())
                }
            }
            else if(key === "top_child")
            {
                const types = this.path!.map.piece_types.filter(
                    (value, index, arr) => this.path!.map.piece_type_instances[index].bottom_initially_free);
                const type = types[Math.floor(random() * types.length)];
                if(type)
                {
                    this.children[key] = new type(this.x, this.y - this.height, this.width, this.height, this.path, this);
                }
            }
            else if(key === "bottom_child")
            {
                const types = this.path!.map.piece_types.filter(
                    (value, index, arr) => this.path!.map.piece_type_instances[index].top_initially_free);
                const type = types[Math.floor(random() * types.length)];
                if(type)
                {
                    this.children[key] = new type(this.x, this.y + this.height, this.width, this.height, this.path, this);
                }
            }
            if(this.path!.map.check_collision_fast(this.children[key]))
            {
                if(this.children.left_child === this.children[key])
                {
                    this.children.left_child = null;
                }
                else if(this.children.right_child === this.children[key])
                {
                    this.children.right_child = null;
                }
                else if(this.children.top_child === this.children[key])
                {
                    this.children.top_child = null;
                }
                else if(this.children.bottom_child === this.children[key])
                {
                    this.children.bottom_child = null;
                }
            }
            else if(this.children[key].is_leaf() && this.path)
            {
                this.path!.leaves.push(this.children[key]);
                this.path.map.last_updated.push(this.path);
                this.path.undo_stack.push(this.children[key]);
                this.path!.map.set_piece_on_cell(this.children[key].x, this.children[key].y);
            }
            if(!this.is_leaf() && this.path)
            {
                const index = this.path!.leaves.indexOf(this);
                if(index !== -1)
                {
                    this.path.leaves.splice(index, 1);
                }
            }
        }
    }
    try_insert_child(x:number, y:number, piece:PathPiece):number
    {
        let inserted = 0;
        if(x <= this.mid_x() && y >= this.y && this.y + this.height >= y)//left
        { 
            if(this.left_free() && piece.right_free())
            {
                inserted = 1;
                this.children.left_child = piece;
                piece.x = this.x - this.width;
                piece.y = this.y;
            }
        }
        else if(x >= this.mid_x() && y >= this.y && this.y + this.height >= y)//right
        {
            if(this.right_free() && piece.left_free())
            {
                inserted = 2;
                this.children.right_child = piece;
                piece.x = this.x + this.width;
                piece.y = this.y;
            }
        }
        else if(y <= this.mid_y() && x >= this.x && this.x + this.width >= x)//top
        {
            if(this.top_free() && piece.bottom_free())
            {
                inserted = 3;
                this.children.top_child = piece;
                piece.x = this.x;
                piece.y = this.y - this.height;
            }
        }
        else if(y >= this.mid_y() && x >= this.x && this.x + this.width >= x)//bottom
        {
            if(this.bottom_free() && piece.top_free())
            {
                inserted = 4;
                this.children.bottom_child = piece;
                piece.x = this.x;
                piece.y = this.y + this.height;
            }
        }
        if(this.path)
        if(inserted && this.path.map.check_collision_fast(piece))
        {
            inserted = 0;
            this.remove_child(piece);
        }
        else if(inserted)
        {
            piece.parent = this;
            piece.path = this.path;
            this.path.leaves.push(piece);
            if(!this.is_leaf())
            {
                const index_tbd = this.path.leaves.indexOf(this);
                if(index_tbd !== -1)
                {
                    this.path.leaves.splice(index_tbd, 1);
                }
            }
            this.path.undo_stack.push(piece);
            this.path.map.set_piece_on_cell(piece.x, piece.y);
        }
        return inserted;
    }
    remove_child(tbd:PathPiece, clear_map:boolean = false):void
    {
        if(tbd === this.children.left_child)
        {
            this.children.left_child = null;
        }
        else if(tbd === this.children.right_child)
        {
            this.children.right_child = null;
        }
        else if(tbd === this.children.top_child)
        {
            this.children.top_child = null;
        }
        else if(tbd === this.children.bottom_child)
        {
            this.children.bottom_child = null;
        }
        if(clear_map)
            this.path!.map.clear_piece_on_cell(this.x, this.y);
    }
};
class HorizontalPathPiece extends PathPiece {

    left_free():boolean
    {
        return super.left_free();
    }
    right_free():boolean
    {
        return super.right_free();
    }
    top_free():boolean
    {
        return false;
    }
    bottom_free():boolean
    {
        return false;
    }
};
class VerticalPathPiece extends PathPiece {
    left_free():boolean
    {
        return false && super.left_free();
    }
    right_free():boolean
    {
        return false && super.right_free();
    }
    top_free():boolean
    {
        return super.top_free();
    }
    bottom_free():boolean
    {
        return super.bottom_free();
    }
};
class LeftBottomPiece extends PathPiece {

    left_free():boolean
    {
        return super.left_free();
    }
    right_free():boolean
    {
        return false && super.right_free();
    }
    top_free():boolean
    {
        return false && super.top_free();
    }
    bottom_free():boolean
    {
        return super.bottom_free();
    }
};
class RightBottomPiece extends PathPiece {

    left_free():boolean
    {
        return false && super.left_free();
    }
    right_free():boolean
    {
        return super.right_free();
    }
    top_free():boolean
    {
        return false && super.top_free();
    }
    bottom_free():boolean
    {
        return super.bottom_free();
    }
};
class LeftTopPiece extends PathPiece {

    left_free():boolean
    {
        return super.left_free();
    }
    right_free():boolean
    {
        return false && super.right_free();
    }
    top_free():boolean
    {
        return super.top_free();
    }
    bottom_free():boolean
    {
        return false && super.bottom_free();
    }
};
class RightTopPiece extends PathPiece {

    left_free():boolean
    {
        return false && super.left_free();
    }
    right_free():boolean
    {
        return super.right_free();
    }
    top_free():boolean
    {
        return super.top_free();
    }
    bottom_free():boolean
    {
        return false && super.bottom_free();
    }
};

class TBottomPiece extends PathPiece {

    left_free():boolean
    {
        return super.left_free();
    }
    right_free():boolean
    {
        return super.right_free();
    }
    top_free():boolean
    {
        return false && super.top_free();
    }
    bottom_free():boolean
    {
        return super.bottom_free();
    }
};
class TTopPiece extends PathPiece {

    left_free():boolean
    {
        return super.left_free();
    }
    right_free():boolean
    {
        return super.right_free();
    }
    top_free():boolean
    {
        return super.top_free();
    }
    bottom_free():boolean
    {
        return false && super.bottom_free();
    }
};
class TLeftPiece extends PathPiece {

    left_free():boolean
    {
        return super.left_free();
    }
    right_free():boolean
    {
        return false && super.right_free();
    }
    top_free():boolean
    {
        return super.top_free();
    }
    bottom_free():boolean
    {
        return super.bottom_free();
    }
};
class TRightPiece extends PathPiece {

    left_free():boolean
    {
        return false && super.left_free();
    }
    right_free():boolean
    {
        return super.right_free();
    }
    top_free():boolean
    {
        return super.top_free();
    }
    bottom_free():boolean
    {
        return super.bottom_free();
    }
};
class Path {
    map:Map;
    undo_stack:PathPiece[];
    leaves:PathPiece[];
    root:PathPiece;
    cell_width:number;
    cell_height:number;
    game:Game;
    constructor(x:number, y:number, width:number, height:number, map:Map)
    {
        this.map = map;
        this.cell_width = width;
        this.cell_height = height;
        this.undo_stack = [];
        x -= x % this.cell_width;
        y -= y % this.cell_height;
        this.root = new PathPiece(x, y, this.cell_width, this.cell_height, this);
        this.root.children.left_child = new PathPiece(x + this.cell_width, y, this.cell_width, this.cell_height, this, this.root);
        this.leaves = [this.root.children.left_child];
    }
    undo_add():PathPiece | null
    {
        if(this.undo_stack.length > 0)
        {
            const tbd = this.undo_stack.pop()!;
            const parent = tbd.parent!;
            this.leaves.splice(this.leaves.indexOf(tbd), 1);
            if(this.leaves.indexOf(parent) === -1)
                this.leaves.push(parent);
            parent.remove_child(tbd, true);
            this.map.clear_piece_on_cell(tbd.x, tbd.y);
            return tbd;
        }
        return null;
    }
    check_collision_slow(collidable:SquareAABBCollidable):PathPiece | null
    {
        let result:PathPiece | null = null;
        this.traverse((piece) => {
            if(collidable.check_collision(piece) && collidable !== piece) 
                result = piece 
        });
        return result;
    }
    pick_random_leaf(): PathPiece | null
    {
        this.leaves = [];
        this.traverse((piece) => {
            if(piece.is_leaf())
                this.leaves.push(piece);
        });
        const index = Math.floor(random() * this.leaves.length);
        return index < this.leaves.length ? this.leaves[index] : null;
    }
    find_nearest_open_leaf(search_point:SquareAABBCollidable, nearest:PathPiece = this.root):PathPiece | null
    {
        let nearest_dist = distance(nearest, search_point);
        this.traverse((piece) => {
            const current_dist = distance(piece, search_point);
            if(nearest_dist > current_dist && !this.map.check_collision_fast(search_point))
            {
                nearest = piece;
                nearest_dist = current_dist;
            }
        })
        return nearest.is_leaf() ? nearest : null;
    }
    find_nearest_leaf(search_point:SquareAABBCollidable, nearest:PathPiece = this.root):PathPiece | null
    {
        let nearest_dist = distance(nearest, search_point);
        this.traverse((piece) => {
            const current_dist = distance(piece, search_point);
            if(nearest_dist > current_dist)
            {
                nearest = piece;
                nearest_dist = current_dist;
            }
        })
        return nearest//nearest.is_leaf() ? nearest : null;
    }
    traverse(apply:(element:PathPiece) => void):void
    {
        const stack = <Array<PathPiece> > [];
        
        stack.push(this.root);
        while(stack.length > 0)
        {
            const current = stack.pop()!;
            apply(current);
            for(const el in current.children)
            {
                const piece:PathPiece = current.children[el];
                if(piece !== null)
                    stack.push(piece);
            }
        }

    }
    draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
        
        this.traverse((current) => current.draw(canvas, ctx, x, y, width, height));
        ctx.strokeRect(this.root.x, this.root.y, this.root.width, this.root.height);
    }
};
class Enemy extends SquareAABBCollidable {
    defense_magic:number;
    defense_fire:number;
    defense_poison:number;
    defense_physical:number;
    shield_magic:number;
    shield_fire:number;
    shield_poison:number;
    shield_physical:number;
    hp:number;
    buildup_burn:number;
    buildup_poison:number;
    buildup_bleed:number;
    game:Game;
    current_target:PathPiece;
    attack:number;
    constructor(x:number, y:number, width:number, height:number, current_target:PathPiece)
    {
        super(x, y, width, height);
        this.game = current_target.path?.map.game!;
        this.direction = [30,0];
        this.current_target = current_target;
        this.attack = 1;
        this.defense_magic = 0.05;
        this.defense_fire = 0.05;
        this.defense_poison = 0.05;
        this.defense_physical = 0.05;
        this.shield_magic = 0;
        this.shield_fire = 0;
        this.shield_poison = 0;
        this.shield_physical = 0;
        this.hp = 0;
        this.buildup_bleed = 0;
        this.buildup_burn = 0;
        this.buildup_poison = 0;
    }
    take_damage(proj:Projectile):boolean
    {
        proj.damage_enemy(this);
        if(this.hp <= 0)
            return false;
        return true;
    }
    apply_poison(delta_time:number):void
    {
        if(this.buildup_poison > 0)
        {
            this.buildup_poison -= this.game.damage_poison_per_sec * delta_time * 1 / 1000;
            if(this.buildup_poison < 0)
            {
                this.shield_poison += this.buildup_poison;
                this.buildup_poison = 0;
            }
            this.shield_poison -= this.game.damage_poison_per_sec * delta_time * 1 / 1000;
            if(this.shield_poison < 0)
            {
                this.hp += this.shield_poison;
                this.shield_poison = 0;
            }
        }
    }
    apply_burn(delta_time:number):void
    {
        if(this.buildup_burn > 0)
        {
            this.buildup_burn -= this.game.damage_burn_per_sec * delta_time * 1 / 1000;
            if(this.buildup_burn < 0)
            {
                this.shield_fire += this.buildup_burn * (1 - this.defense_fire);
                this.buildup_burn = 0;
            }
            this.shield_fire -= this.game.damage_burn_per_sec  * (1 - this.defense_fire) * delta_time * 1 / 1000;
            if(this.shield_fire < 0)
            {
                this.hp += this.shield_fire * (1 - this.defense_fire);
                this.shield_fire = 0;
            }
        }
    }
    apply_bleed(delta_time:number):void
    {
        if(this.buildup_bleed > 0)
        {
            this.buildup_bleed -= this.game.damage_bleed_per_sec * delta_time * 1 / 1000;
            if(this.buildup_bleed < 0)
            {
                this.shield_physical += this.buildup_bleed * (1 - this.defense_physical);
                this.buildup_bleed = 0;
            }
            this.shield_physical -= this.game.damage_bleed_per_sec  * (1 - this.defense_physical) * delta_time * 1 / 1000;
            if(this.shield_physical < 0)
            {
                this.hp += this.shield_physical * (1 - this.defense_physical);
                this.shield_physical = 0;
            }
        }
    }
    lose_hp(damage:number):void
    {
        if(this.hp > 0)
        {
            this.shield_physical -= damage * (1 - this.defense_physical);
            if(this.shield_physical < 0)
            {
                this.shield_physical *= 1 / (1 - this.defense_physical);
                this.shield_fire += this.shield_physical * (1 - this.defense_fire);
                this.shield_physical = 0;
            }
            if(this.shield_fire < 0)
            {
                this.shield_fire *= 1 / (1 - this.defense_fire);
                this.shield_poison += this.shield_fire * (1 - this.defense_poison);
                this.shield_fire = 0;
            }
            if(this.shield_poison < 0)
            {
                this.shield_poison *= 1 / (1 - this.defense_poison);
                this.shield_magic += this.shield_poison * (1 - this.defense_magic);
                this.shield_poison = 0;
            }
            if(this.shield_magic < 0)
            {
                this.shield_magic *= 1 / (1 - this.defense_magic);
                this.hp += this.shield_magic * (1 - this.defense_physical);
                this.shield_magic = 0;
            }
        }
    }
    add_poison(damage:number):void
    {
        this.buildup_poison += damage;
    }
    add_burn(damage:number):void
    {
        this.buildup_burn += damage;
    }
    add_bleed(damage:number):void
    {
        this.buildup_bleed += damage;
    }
    update_state(delta_time: number):void {
        if(this.hp > 0)
        {
            this.apply_poison(delta_time);
            this.apply_burn(delta_time);
            this.apply_bleed(delta_time);
        }
        this.set_direction_vector_to_face(this.current_target);
        if(this.distance(this.current_target) < 10)
        {
            if(this.current_target.parent)
            {
                this.current_target = this.current_target.parent;
            }
            else
            {
                this.game.lives -= this.attack * delta_time * 1/1000;
            }
        }
        super.update_state(delta_time); 
    }
    draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
        ctx.fillStyle = "#000000";
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
};
class Map {
    game:Game;
    paths:Path[];
    path_cell_map:DynamicInt32Array;
    last_updated:Path[];
    enemies:Enemy[];
    towers:Tower[];
    cell_dim:number;
    piece_types:typeof PathPiece[];
    piece_type_instances:PathPiece[];
    
    constructor(x:number, y:number, game:Game)
    {
        const min_dim = 32;
        this.game = game;
        this.enemies = [];
        this.last_updated = [];
        this.cell_dim = min_dim;
        this.paths = [new Path(x, y, min_dim, min_dim, this)];
        this.path_cell_map = new DynamicInt32Array(this.horizontal_cells() * this.vertical_cells())
        this.piece_types = [HorizontalPathPiece, VerticalPathPiece, LeftBottomPiece, RightBottomPiece, 
            LeftTopPiece, RightTopPiece, TBottomPiece, TTopPiece, TLeftPiece, TRightPiece];
        this.piece_type_instances = [];
        for(let i = 0; i < this.piece_types.length; i++)
        {
            const type = this.piece_types[i];
            this.piece_type_instances.push(new type(0, 0, 0, 0, null, null));
        }
    }

    get_path_piece_parent_world_space(x:number, y:number):number[]
    {
        x = Math.floor(x / this.cell_dim);
        y = Math.floor(y / this.cell_dim);
        const wx = this.get_path_piece_parent(x, y) % this.horizontal_cells() * this.cell_dim;
        const wy = Math.floor(this.get_path_piece_parent(x, y) / this.horizontal_cells()) * this.cell_dim;
        return [wx + this.cell_dim * 0.5, wy + this.cell_dim * 0.5];
    }
    get_path_piece_parent(x:number, y:number):number
    {
        return this.path_cell_map[x + y * this.horizontal_cells()] >> 1;
    }
    set_path_piece_parent(parent_index:number, x:number, y:number):void
    {
        const current = x + y * this.horizontal_cells();
        this.path_cell_map[current] &= 1;
        this.path_cell_map[current] |= parent_index << 1;
    }
    set_piece_on_cell(x:number, y:number):void
    {
        const gx = Math.floor(x / this.cell_dim);
        const gy = Math.floor(y / this.cell_dim);
        const gindex = gx + gy * this.horizontal_cells();
        this.path_cell_map[gindex] |= this.piece_bit_mask();
    }
    clear_piece_on_cell(x:number, y:number):void
    {
        const gx = Math.floor(x / this.cell_dim);
        const gy = Math.floor(y / this.cell_dim);
        const gindex = gx + gy * this.horizontal_cells();
        this.path_cell_map[gindex] &= ~this.piece_bit_mask();
    }
    is_piece_on_cell(x:number, y:number):boolean
    {
        const gx = Math.floor(x / this.cell_dim);
        const gy = Math.floor(y / this.cell_dim);
        const gindex = gx + gy * this.horizontal_cells();
        return (this.path_cell_map[gindex] & this.piece_bit_mask()) === this.piece_bit_mask();
    }
    is_piece_here(x:number, y:number):boolean
    {
        const gindex = x + y * this.horizontal_cells();
        return (this.path_cell_map[gindex] & this.piece_bit_mask()) === this.piece_bit_mask();
    }
    piece_bit_mask():number
    {
        return 1;
    }
    horizontal_cells():number
    {
        return Math.ceil(this.game.max_x / this.cell_dim);
    }
    vertical_cells():number
    {
        return Math.ceil(this.game.max_y / this.cell_dim);
    }
    undo():void
    {
        if(this.last_updated.length > 0)
        {
            const path = this.last_updated.pop()!;
            path.undo_add();
        }
    }
    translate_to_cell_pos(pos:SquareAABBCollidable):void
    {
        pos.x -= pos.x % this.cell_dim;
        pos.y -= pos.y % this.cell_dim;
    }
    try_add_piece(x:number, y:number):boolean
    {
        let nearest_path = this.paths[0];
        const pos = new SquareAABBCollidable(x - this.cell_dim / 4, y - this.cell_dim / 4, this.cell_dim/2, this.cell_dim/2);
        let nearest_leaf = nearest_path.check_collision_slow(pos);
        //nearest_leaf = nearest_leaf && nearest_leaf.check_collision(pos)?nearest_leaf:null;
        console.log(nearest_leaf, x, y)
        for(let i = 1; i < this.paths.length; i++)
        {
            const path = this.paths[i];
            const leaf = nearest_path.check_collision_slow(pos);
            if(leaf && leaf.check_collision(pos))
            {
                nearest_path = path;
                nearest_leaf = leaf;
            }
        }
        if(nearest_leaf && nearest_path)
        {
            let piece:PathPiece|null = null;
            if(x < nearest_leaf.mid_x() && y >= nearest_leaf.y && nearest_leaf.y + nearest_leaf.height > y)//left
            {
                const types = this.piece_types.filter((piece, index, arr) => this.piece_type_instances[index].right_initially_free);
                piece = new types[Math.floor(random() * types.length)](nearest_leaf.x - this.cell_dim, nearest_leaf.y, nearest_leaf.width, nearest_leaf.height, nearest_path, nearest_leaf);
            }
            else if(x >= nearest_leaf.mid_x() && y >= nearest_leaf.y && nearest_leaf.y + nearest_leaf.height > y)//right
            {
                const types = this.piece_types.filter((piece, index, arr) => this.piece_type_instances[index].left_initially_free);
                piece = new types[Math.floor(random() * types.length)](nearest_leaf.x + this.cell_dim, nearest_leaf.y, nearest_leaf.width, nearest_leaf.height, nearest_path, nearest_leaf);
            }
            else if(y < nearest_leaf.mid_y() && x >= nearest_leaf.x && nearest_leaf.x + nearest_leaf.width > x)//top
            {
                const types = this.piece_types.filter((piece, index, arr) => this.piece_type_instances[index].bottom_initially_free);
                piece = new types[Math.floor(random() * types.length)](nearest_leaf.x, nearest_leaf.y - this.cell_dim, nearest_leaf.width, nearest_leaf.height, nearest_path, nearest_leaf);
            }
            else if(y >= nearest_leaf.mid_y() && x >= nearest_leaf.x && nearest_leaf.x + nearest_leaf.width > x)//bottom
            {
                const types = this.piece_types.filter((piece, index, arr) => this.piece_type_instances[index].top_initially_free);
                piece = new types[Math.floor(random() * types.length)](nearest_leaf.x, nearest_leaf.y + this.cell_dim, nearest_leaf.width, nearest_leaf.height, nearest_path, nearest_leaf);
            }
            if(piece)
                console.log("passes check collision fast:",!this.check_collision_fast(piece!), console.log(piece))
            if(piece && !this.check_collision_fast(piece))
            {
                this.last_updated.push(nearest_path);
                nearest_leaf.try_insert_child(x, y, piece);
                return true;
            }
        }
        return false;
    }
    pick_random_path():Path
    {
        return this.paths[Math.floor(random() * this.paths.length)];
    }
    add_random_enemy():void
    {
        const type_index = Math.floor(random() * this.game.enemy_types.length);
        const path = this.pick_random_path();
        const leaf = path.pick_random_leaf()!;
        if(leaf)
        {
            const enemy = new this.game.enemy_types[type_index]!(leaf.mid_x(), leaf.mid_y() - leaf.width / 2, leaf.width / 2, leaf.width / 2, leaf);
            this.enemies.push(enemy);
        }
    }
    check_collision_fast(collidable:SquareAABBCollidable):boolean
    {
        return this.is_piece_on_cell(collidable.x, collidable.y);
    }
    update_state(delta_time: number):void {
        this.enemies.forEach(enemy => enemy.update_state(delta_time));
    }
    draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
        this.paths.forEach(path => path.draw(canvas, ctx, x, y, width, height));
        this.enemies.forEach(enemy => enemy.draw(canvas, ctx, x, y, width, height));
    }
};

class Game extends SquareAABBCollidable {
    max_x:number;
    max_y:number;
    x_translation:number;
    y_translation:number;
    scale:number;
    damage_bleed_per_sec:number;
    damage_magic_per_sec:number;
    damage_poison_per_sec:number;
    damage_burn_per_sec:number;
    enemy_types:typeof Enemy[];
    lives:number;
    map:Map;
    canvas:HTMLCanvasElement;
    ctx:CanvasRenderingContext2D;
    constructor(starting_lives:number, x:number, y:number, width:number, height:number)
    {
        super(x, y, width, height);
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d")!;
        this.max_x = 4000;
        this.max_y = 4000;
        this.canvas.width = this.max_x;
        this.canvas.height = this.max_y;
        this.x_translation = Math.floor(this.max_x / 2);
        this.y_translation = Math.floor(this.max_y / 2);
        this.scale = 0.5;
        this.lives = starting_lives;
        this.damage_bleed_per_sec = 50;
        this.damage_burn_per_sec = 50;
        this.damage_magic_per_sec = 50;
        this.damage_poison_per_sec = 100;
        this.enemy_types = [Enemy];
        this.map = new Map(this.x_translation, this.y_translation, this);
        this.restart_game();
        this.map.add_random_enemy();
    }
    restart_game():void
    {
    }
    init(width:number, height:number, cell_width:number, cell_height:number):void
    {
    }
    trasform_x_to_world_space(x:number):number
    {
        return x / this.scale + this.x_translation;
    }
    trasform_y_to_world_space(y:number):number
    {
        return y / this.scale + this.y_translation;
    }
    try_add_piece(x:number, y:number):boolean
    {
        const inv_scale = 1/this.scale;
        x = this.trasform_x_to_world_space(x);
        y = this.trasform_y_to_world_space(y);
        return this.map.try_add_piece(x, y);
    }
    try_place_ballista(x:number, y:number):boolean
    {
        const inv_scale = 1/this.scale;
        x = this.trasform_x_to_world_space(x);
        y = this.trasform_y_to_world_space(y);
        return this.map.try_add_piece(x, y);
    }
    resize(width:number, height:number):void
    {
        this.width = width;
        this.height = height;
    }
    draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void 
    {
        ctx.imageSmoothingEnabled = false;
        this.ctx.imageSmoothingEnabled = false;
        const inv_scale = 1/this.scale;
        this.ctx.clearRect(0, 0, this.max_x, this.max_y);
        this.map.draw(this.canvas, this.ctx, 0, 0, this.max_x, this.max_y);
        ctx.drawImage(this.canvas, this.x_translation, this.y_translation, width * inv_scale, height * inv_scale, x, y, width, height);
    }
    update_state(delta_time: number): void 
    {
        this.map.update_state(delta_time);
    }
};
const keyboardHandler = new KeyboardHandler();
async function main()
{
    const canvas:HTMLCanvasElement = <HTMLCanvasElement> document.getElementById("screen");
    const touchListener = new SingleTouchListener(canvas, true, true, false);


    canvas.width = getWidth();
    canvas.height = getHeight();
    canvas.style.cursor = "pointer";
    let counter = 0;
    const touchScreen:boolean = isTouchSupported();
    let height = getHeight();
    let width = getWidth();
    let game = new Game(3, 0, 0, height, width);
    window.game = game;
    canvas.addEventListener("wheel", (e) => {
        //e.preventDefault();
        game.scale += e.deltaY / 100;
        if(game.scale < 0.2)
        {
            game.scale = 0.2;
        }
        else if(game.scale > 15)
        {
            game.scale = 15;
        }
    });
    let low_fps:boolean = false;
    touchListener.registerCallBack("touchend", (event:any) => keyboardHandler.keysHeld["ControlLeft"] || keyboardHandler.keysHeld["ControlRight"] ||
    keyboardHandler.keysHeld["MetaLeft"] || keyboardHandler.keysHeld["MetaRight"], (event:any) => {
       if(game.try_add_piece(event.touchPos[0], event.touchPos[1]))
        console.log("added");
    else
        console.log("nnoooot")
        game.map.add_random_enemy();
    });
    touchListener.registerCallBack("touchend", (event) => !(keyboardHandler.keysHeld["ControlLeft"] || keyboardHandler.keysHeld["ControlRight"] ||
    keyboardHandler.keysHeld["MetaLeft"] || keyboardHandler.keysHeld["MetaRight"]), (event:TouchMoveEvent) => {
        game.try_place_ballista(event.touchPos[0], event.touchPos[1]);
    })
    touchListener.registerCallBack("touchmove", (event:any) => true, (event:any) => {
        const inv_scale = 1 / game.scale;
        game.x_translation -= event.deltaX * inv_scale;
        game.y_translation -= event.deltaY * inv_scale;
    });
    //setInterval(() => {for(let i = 0; i < 200; i++) game.add_ball(); game.balls.forEach(ball => ball.release());}, 50)
    keyboardHandler.registerCallBack("keydown", () => true, (event:any) => {
        if(!keyboardHandler.keysHeld["MetaLeft"] && !keyboardHandler.keysHeld["ControlLeft"] &&
            !keyboardHandler.keysHeld["MetaRight"] && !keyboardHandler.keysHeld["ControlRight"])
            event.preventDefault();
        switch(event.code)
        {

        }
    });        keyboardHandler.registerCallBack("keydown", (e:any) => true, event => {
        if(keyboardHandler.keysHeld["ControlLeft"] || keyboardHandler.keysHeld["ControlRight"] ||
            keyboardHandler.keysHeld["MetaLeft"] || keyboardHandler.keysHeld["MetaRight"]){
            switch(event.code) {
            case('KeyC'):
            break;
            case('KeyV'):
            break;
            case('KeyZ'):
            game.map.undo();
            break;
            case('KeyY'):
            break;
            }
        }
    });
    let maybectx:CanvasRenderingContext2D | null = canvas.getContext("2d");
    if(!maybectx)
        return;
    const ctx:CanvasRenderingContext2D = maybectx;
    let start = Date.now();
    let dt = 1;
    const ostart = Date.now();
    let frame_count = 0;
    let instantaneous_fps = 0;
    const time_queue:FixedSizeQueue<number> = new FixedSizeQueue<number>(60 * 2);
    const header = document.getElementById("header");
    srand(Math.random() * max_32_bit_signed);


    const drawLoop = () => 
    {
        frame_count++;
        //do stuff and render here
        if(getWidth() !== width)
        {
            width = getWidth();
            height = getHeight() - header!.clientHeight - 150;
            game.resize(width, height);
            canvas.width = width;
            canvas.height = height;
        }

        dt = Date.now() - start;
        time_queue.push(dt);
        start = Date.now();
        let sum = 0;
        let highest = 0;
        for(let i = 0; i < time_queue.length; i++)
        {
            const value = time_queue.get(i);
            sum += value;
            if(highest < value)
            {
                highest = value;
            }
        }
        if(dt < 1000)
        {
            game.update_state(dt);
        }
        ctx.fillStyle = "#000000";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        game.draw(canvas, ctx, game.x, game.y, canvas.width, canvas.height);
        if(frame_count % 10 === 0)
            instantaneous_fps = Math.floor(1000 / (low_fps?highest:dt));
        let text = "";
        ctx.fillStyle = "#FFFFFF";
        text = `avg fps: ${Math.floor(1000 * time_queue.length / sum)}, ${low_fps?"low":"ins"} fps: ${instantaneous_fps}`;
        const text_width = ctx.measureText(text).width;
        ctx.strokeText(text, game.width - text_width - 10, menu_font_size());
        ctx.fillText(text, game.width - text_width - 10, menu_font_size());

        requestAnimationFrame(drawLoop);
    }
    drawLoop();
    game.resize(width, height - header!.clientHeight - 150);

}
main();





