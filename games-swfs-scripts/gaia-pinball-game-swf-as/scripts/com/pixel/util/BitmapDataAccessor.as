package com.pixel.util
{
   import com.pixel.transitions.TransitionPixel;
   import flash.display.BitmapData;
   import flash.display.DisplayObjectContainer;
   import flash.display.IBitmapDrawable;
   import flash.display.Loader;
   import flash.display.MovieClip;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.geom.ColorTransform;
   import flash.geom.Matrix;
   import flash.geom.Rectangle;
   import flash.net.URLRequest;
   
   public class BitmapDataAccessor extends Sprite
   {
      
      public static var LOAD_COMPLETE:String = "onBitmapLoadComplete";
      
      private var bitmapContainer:BitmapData;
      
      private var loader:Loader;
      
      private var imageContainer:DisplayObjectContainer;
      
      private var isExplicit:Boolean;
      
      public function BitmapDataAccessor(param1:String = null, param2:DisplayObjectContainer = null)
      {
         super();
         imageContainer = new MovieClip();
         imageContainer.cacheAsBitmap = true;
         if(param2 == null)
         {
            isExplicit = false;
            loader = new Loader();
            loader.contentLoaderInfo.addEventListener(Event.COMPLETE,loadingCompleted,false,0,true);
            loader.load(new URLRequest(param1));
         }
         else
         {
            isExplicit = true;
            imageContainer = param2;
            loadingCompleted();
         }
      }
      
      public function dispose() : void
      {
         bitmapContainer.dispose();
      }
      
      public function get bitmap() : BitmapData
      {
         return bitmapContainer;
      }
      
      public function updateBitmap(param1:IBitmapDrawable, param2:Matrix = null, param3:ColorTransform = null, param4:String = null, param5:Rectangle = null, param6:Boolean = false) : void
      {
         bitmapContainer.draw(param1,param2,param3,param4,param5,param6);
      }
      
      private function loadingCompleted(param1:Event = null) : void
      {
         var transparent:Boolean = false;
         var fillColor:Number = NaN;
         var e:Event = param1;
         transparent = true;
         fillColor = 16711935;
         try
         {
            if(e != null)
            {
               bitmapContainer = new BitmapData(loader.content.width,loader.content.height,transparent,fillColor);
               bitmapContainer.draw(loader.content);
            }
            else
            {
               bitmapContainer = new BitmapData(imageContainer.width,imageContainer.height,transparent,fillColor);
               bitmapContainer.draw(imageContainer);
            }
            dispatchEvent(new Event(BitmapDataAccessor.LOAD_COMPLETE,true,false));
         }
         catch(err:Error)
         {
         }
      }
      
      public function getPixelColor(param1:Number, param2:Number) : Number
      {
         return bitmapContainer.getPixel(param1,param2);
      }
      
      public function isTransparent(param1:Number, param2:Number, param3:Number, param4:Number, param5:int = 1) : Boolean
      {
         var _loc6_:int = 0;
         var _loc7_:int = 0;
         _loc6_ = 0;
         while(_loc6_ < param3)
         {
            _loc7_ = 0;
            while(_loc7_ < param4)
            {
               if((bitmapContainer.getPixel32(_loc6_ + param1,_loc7_ + param2) >> 24 & 0xFF) > 0)
               {
                  return false;
               }
               _loc7_ += param5;
            }
            _loc6_ += param5;
         }
         return true;
      }
      
      public function generateTransitionPixels(param1:Number, param2:Number, param3:Number, param4:int = 1, param5:Boolean = true) : Array
      {
         var _loc6_:Number = NaN;
         var _loc7_:Number = NaN;
         var _loc8_:Array = null;
         var _loc9_:uint = 0;
         var _loc10_:Boolean = false;
         var _loc11_:TransitionPixel = null;
         var _loc12_:Rectangle = null;
         var _loc13_:int = 0;
         var _loc14_:int = 0;
         param3 = Math.abs(param3);
         param1 = Math.abs(param1);
         param2 = Math.abs(param2);
         _loc6_ = bitmapContainer.width;
         _loc7_ = bitmapContainer.height;
         _loc8_ = new Array();
         _loc9_ = 0;
         _loc10_ = false;
         _loc13_ = 0;
         while(_loc13_ < _loc7_)
         {
            _loc14_ = 0;
            while(_loc14_ < _loc6_)
            {
               if(param5)
               {
                  _loc10_ = isTransparent(_loc14_,_loc13_,param1,param2,param4);
               }
               if(!_loc10_)
               {
                  _loc11_ = new TransitionPixel();
                  _loc12_ = new Rectangle(_loc14_,_loc13_,param1,param2);
                  _loc11_.initRect = _loc12_;
                  _loc8_[_loc9_] = _loc11_;
                  _loc9_++;
               }
               _loc14_ += param1 + param3;
            }
            _loc13_ += param2 + param3;
         }
         return _loc8_;
      }
   }
}

