package com.gaiaonline.games.gPinball.compound_elements
{
   import com.custom.KeyCheck;
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.simple_elements.Ball;
   import com.gaiaonline.games.gPinball.simple_elements.Obstacle;
   import com.gaiaonline.games.gPinball.vector2d;
   import flash.display.DisplayObject;
   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.events.KeyboardEvent;
   import flash.geom.Point;
   
   public class Flipper extends MovieClip
   {
      
      public var power:Number = 25;
      
      public var __Active:Boolean;
      
      public var power_adjust:Number;
      
      public var flip_rot:Number;
      
      public var art:MovieClip;
      
      public var init_rot:Number;
      
      public var __SndEffectUnflip:String = "none";
      
      public var keydown:Boolean;
      
      public var __NeedsInit:Boolean = true;
      
      public var fliparea:MovieClip;
      
      public var __Location:String = "table";
      
      public var ref_v:vector2d;
      
      public var hit:MovieClip;
      
      public var key_code:int;
      
      public var ref:MovieClip;
      
      public var __SID:int = 10;
      
      public var __SndEffectFlip:String = "none";
      
      public function Flipper()
      {
         super();
         PinballCore.__Root.__Flippers.push(this);
         init_rot = hit.rotation;
         flip_rot = hit.rotation - 50;
         ref_v = new vector2d(ref.x,ref.y);
         power_adjust = 0.2;
         fliparea.visible = false;
         __Active = true;
      }
      
      public function setActive(param1:Boolean) : void
      {
         var _loc2_:uint = 0;
         var _loc3_:DisplayObject = null;
         __Active = param1;
         if(__Active)
         {
         }
         _loc2_ = 0;
         while(_loc2_ < hit.numChildren)
         {
            _loc3_ = hit.getChildAt(_loc2_);
            if(_loc3_ is Obstacle)
            {
               (_loc3_ as Obstacle).setActive(param1);
            }
            _loc2_++;
         }
      }
      
      public function init(param1:int) : void
      {
         var _loc2_:uint = 0;
         var _loc3_:DisplayObject = null;
         if(__NeedsInit)
         {
            _loc2_ = 0;
            while(_loc2_ < hit.numChildren)
            {
               _loc3_ = hit.getChildAt(_loc2_);
               if(_loc3_ is Obstacle)
               {
                  (_loc3_ as Obstacle).init(0,0,__Location,null,0);
               }
               _loc2_++;
            }
            key_code = param1;
            stage.removeEventListener(KeyboardEvent.KEY_DOWN,checkKeyDown);
            stage.removeEventListener(KeyboardEvent.KEY_UP,checkKeyUp);
            stage.addEventListener(KeyboardEvent.KEY_DOWN,checkKeyDown,false,0,true);
            stage.addEventListener(KeyboardEvent.KEY_UP,checkKeyUp,false,0,true);
            __NeedsInit = false;
         }
      }
      
      public function releaseFlip() : void
      {
         var _loc1_:Flipper = null;
         _loc1_ = this;
         _loc1_.keydown = false;
         _loc1_.hit.rotation = _loc1_.init_rot;
         _loc1_.art.gotoAndStop("unflip");
         if(__SndEffectUnflip != "none")
         {
            PinballCore.__Root.playSound(__SndEffectUnflip);
         }
      }
      
      public function getLocation() : String
      {
         return __Location;
      }
      
      public function setSID(param1:int) : void
      {
         __SID = param1;
      }
      
      public function disableMagnatron() : void
      {
         PinballCore.__Root.pauseMagnatron();
      }
      
      public function checkKeyUp(param1:Event) : void
      {
         if(PinballCore.__Root == null || PinballCore.__Table == null)
         {
            return;
         }
         if(!KeyCheck.isDown(this.key_code))
         {
            this.releaseFlip();
         }
      }
      
      public function flip() : void
      {
         var _loc1_:int = 0;
         var _loc2_:Ball = null;
         var _loc3_:Point = null;
         var _loc4_:vector2d = null;
         var _loc5_:Number = NaN;
         var _loc6_:Number = NaN;
         var _loc7_:Number = NaN;
         if(PinballCore.__Root == null || PinballCore.__Table == null)
         {
            return;
         }
         if(PinballCore.__Root.__Magnatron)
         {
            disableMagnatron();
         }
         _loc1_ = 0;
         while(_loc1_ < PinballCore.__Table.Balls.length)
         {
            _loc2_ = PinballCore.__Table.Balls[_loc1_];
            if(_loc2_.hitTestObject(this.fliparea) && _loc2_.__Location == __Location)
            {
               _loc3_ = new Point(_loc2_.x,_loc2_.y);
               _loc3_ = PinballCore.__Table.localToGlobal(_loc3_);
               _loc3_ = this.globalToLocal(_loc3_);
               if(_loc3_.x > 0)
               {
                  _loc4_ = new vector2d(_loc3_.x,_loc3_.y);
                  _loc5_ = _loc4_.norm();
                  _loc6_ = _loc4_.angle_sine(this.ref_v);
                  _loc7_ = Math.abs(Math.tan(_loc6_) * _loc5_);
                  _loc4_.rotate(PinballCore.__Table.sin90,PinballCore.__Table.cos90);
                  _loc4_.unit_vector();
                  _loc4_.scalar(_loc7_ * this.power_adjust + this.power);
                  if(this.rotation > 90)
                  {
                     _loc4_.x *= -1;
                  }
                  _loc2_.v.addition(_loc4_);
                  _loc2_.update();
                  PinballCore.__Root.__HitQueue.push(__SID);
               }
            }
            _loc1_++;
         }
         this.hit.rotation = this.flip_rot;
         this.art.gotoAndStop("flip");
         this.keydown = true;
         if(__SndEffectFlip != "none")
         {
            PinballCore.__Root.playSound(__SndEffectFlip);
         }
      }
      
      public function ClearMem() : void
      {
         __Location = null;
         stage.removeEventListener(KeyboardEvent.KEY_DOWN,checkKeyDown);
         stage.removeEventListener(KeyboardEvent.KEY_UP,checkKeyUp);
         dispatchEvent(new Event("doneClearMem"));
      }
      
      public function checkKeyDown(param1:Event) : void
      {
         var _loc2_:Flipper = null;
         if(PinballCore.__Root == null || PinballCore.__Table == null)
         {
            return;
         }
         if(PinballCore.__KeyboardIO)
         {
            _loc2_ = this;
            if(KeyCheck.isDown(this.key_code) && !_loc2_.keydown && __Active)
            {
               _loc2_.flip();
            }
         }
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[Flipper]",param1);
      }
      
      public function removeFlipListener() : void
      {
         stage.removeEventListener(KeyboardEvent.KEY_DOWN,checkKeyDown);
         stage.removeEventListener(KeyboardEvent.KEY_UP,checkKeyUp);
      }
   }
}

