package com.gaiaonline.games.gPinball.simple_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import flash.display.MovieClip;
   import flash.events.*;
   import flash.text.TextField;
   import flash.text.TextFieldAutoSize;
   
   public class InventoryItem extends MovieClip
   {
      
      public var __Active:Boolean;
      
      public var item:MovieClip;
      
      public var qtyField:MovieClip;
      
      public var __QTY:int;
      
      public var __SID:int;
      
      public function InventoryItem()
      {
         super();
         __QTY = 0;
         __SID = 0;
      }
      
      public function activate(param1:int, param2:int) : void
      {
         __SID = param1;
         __QTY = 0;
         if(param2)
         {
            __QTY = param2;
         }
         setText(__QTY);
         __Active = true;
         setState(null);
      }
      
      public function init(param1:Event) : void
      {
         setText(__QTY);
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[Inventory]",param1);
      }
      
      public function setState(param1:Event) : void
      {
         if(__Active)
         {
            item.gotoAndStop("ON");
            setText(__QTY);
         }
         else
         {
            item.gotoAndStop("OFF");
         }
      }
      
      public function reset() : void
      {
      }
      
      public function deactivate(param1:Boolean) : void
      {
         __QTY = __QTY - 1;
         setText(__QTY);
         if(__QTY <= 0)
         {
            __Active = false;
         }
         dTrace("Using " + name + " with SID: " + __SID);
         setState(null);
         if(param1)
         {
            PinballCore.__Root.useItem(__SID);
         }
      }
      
      public function setText(param1:int) : void
      {
         if(param1 > 0)
         {
            qtyField.value.text = "x" + param1.toString();
         }
         else
         {
            qtyField.value.text = "";
         }
         (qtyField.value as TextField).autoSize = TextFieldAutoSize.CENTER;
      }
      
      public function update(param1:int, param2:int) : void
      {
         __SID = param1;
         if(param2)
         {
            __QTY = param2;
         }
         setText(__QTY);
      }
   }
}

