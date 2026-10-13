package
{
   import com.gaiaonline.games.gPinball.simple_elements.InventoryItem;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol931")]
   public dynamic class mcPOWThingy5Temp extends InventoryItem
   {
      
      public function mcPOWThingy5Temp()
      {
         super();
         addFrameScript(0,frame1,4,frame5,8,frame9);
      }
      
      internal function frame1() : *
      {
         stop();
      }
      
      internal function frame5() : *
      {
         stop();
      }
      
      internal function frame9() : *
      {
         gotoAndStop(1);
      }
   }
}

